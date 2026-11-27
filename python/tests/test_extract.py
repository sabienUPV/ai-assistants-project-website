import contextlib
import io
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from openai import APIError
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Inches

import extract


class ExtractTests(unittest.TestCase):
    def setUp(self):
        for name in ("_llms_schema_context", "_llms_schema_error"):
            cache = patch.object(extract, name, None)
            cache.start()
            self.addCleanup(cache.stop)

    def test_argument_parsing_and_exclusive_modes(self):
        parser = extract.build_parser()
        args = parser.parse_args([
            "--api", "--api-key", "key", "--base-url", "https://example.test/v1",
            "--model", "model", "-f", "1 - Example.pptx", "-y", "--dry-run",
        ])
        self.assertTrue(args.api)
        self.assertFalse(args.manual)
        self.assertEqual(args.api_key, "key")
        self.assertEqual(args.base_url, "https://example.test/v1")
        self.assertEqual(args.model, "model")
        self.assertEqual(args.file, "1 - Example.pptx")
        self.assertTrue(args.yes)
        self.assertTrue(args.dry_run)
        self.assertTrue(parser.parse_args(["--manual"]).manual)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            parser.parse_args(["--api", "--manual"])
        self.assertEqual(error.exception.code, 2)

    def test_config_precedence_and_parent_dotenv(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            script_dir = root / "python"
            script_dir.mkdir()
            (root / ".env").write_text(
                "LLM_API_KEY=file-key\nLLM_BASE_URL=https://file.test/v1\n"
                "LLM_MODEL=file-model\n",
                encoding="utf-8",
            )
            args = extract.build_parser().parse_args(["--api-key", "cli-key"])
            with patch.object(extract, "__file__", str(script_dir / "extract.py")):
                with patch.dict(os.environ, {"LLM_MODEL": "env-model"}, clear=True):
                    config = extract.resolve_config(args)
            self.assertEqual(config, {
                "api_key": "cli-key",
                "base_url": "https://file.test/v1",
                "model": "env-model",
            })

            (script_dir / ".env").write_text("LLM_MODEL=local-model\n", encoding="utf-8")
            with patch.object(extract, "__file__", str(script_dir / "extract.py")):
                with patch.dict(os.environ, {}, clear=True):
                    defaults = extract.resolve_config(extract.build_parser().parse_args([]))
            self.assertEqual(defaults, {
                "api_key": None,
                "base_url": None,
                "model": "local-model",
            })

    def test_api_key_masking(self):
        self.assertEqual(extract.mask_api_key("sk-example1234"), "sk-****1234")
        self.assertEqual(extract.mask_api_key("abc"), "***")

    def test_dry_run_without_mode_never_prompts(self):
        config = {"api_key": None, "base_url": None, "model": None}
        for is_tty in (True, False):
            for yes in (True, False):
                with self.subTest(is_tty=is_tty, yes=yes):
                    argv = ["extract.py", "--dry-run"] + (["--yes"] if yes else [])
                    with patch.object(sys, "argv", argv), \
                            patch.object(sys.stdin, "isatty", return_value=is_tty), \
                            patch.object(extract, "resolve_config", return_value=config), \
                            patch.object(extract, "interactive_menu") as menu, \
                            patch.object(extract, "configure_api") as configure, \
                            patch.object(extract, "extract_pptx_data", return_value=0) as run:
                        self.assertEqual(extract.main(), 0)
                    menu.assert_not_called()
                    configure.assert_not_called()
                    run.assert_called_once_with("manual", True, config, None)

    def test_dry_run_generates_prompt_without_final_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pptx_path = root / "1 - Example.pptx"
            presentation = Presentation()
            slide = presentation.slides.add_slide(presentation.slide_layouts[6])
            slide.shapes.add_textbox(100000, 100000, 3000000, 500000).text = "Example slide"
            presentation.save(pptx_path)
            with patch.object(sys, "argv", ["extract.py", "--dry-run", "--file", str(pptx_path)]), \
                    patch.object(sys.stdin, "isatty", return_value=False), \
                    patch.object(extract, "resolve_config", return_value={}), \
                    patch.object(extract, "LOCAL_IMG_DIR", str(root / "images")), \
                    patch.object(extract, "CONTENT_DIR", str(root / "content")), \
                    patch.object(extract, "ASSETS_DIR", str(root / "assets")), \
                    patch.object(extract, "urlopen", side_effect=OSError("offline")), \
                    patch.object(extract, "call_llm_api") as api, \
                    contextlib.redirect_stdout(io.StringIO()) as stdout, \
                    contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(extract.main(), 0)
            api.assert_not_called()
            self.assertIn("System Role:", stdout.getvalue())
            self.assertIn("Example slide", stdout.getvalue())
            self.assertIn('title="GAME: \\"', stdout.getvalue())
            self.assertFalse((root / "content").exists())
            self.assertFalse((root / "assets").exists())

    def test_api_response_fences(self):
        config = {"api_key": "key", "base_url": "https://example.test/v1", "model": "model"}
        client = Mock()
        for language in ("markdoc", "markdown", ""):
            with self.subTest(language=language):
                client.chat.completions.create.return_value = SimpleNamespace(
                    choices=[SimpleNamespace(message=SimpleNamespace(
                        content=f"```{language}\n{{% slide title=\"Title\" %}}\nBody\n{{% /slide %}}\n```"
                    ))]
                )
                with patch.object(extract, "OpenAI", return_value=client) as factory:
                    with contextlib.redirect_stderr(io.StringIO()):
                        result = extract.call_llm_api("prompt", config)
                self.assertEqual(result, '{% slide title="Title" %}\nBody\n{% /slide %}')
                factory.assert_called_once_with(api_key="key", base_url="https://example.test/v1")
                client.chat.completions.create.assert_called_with(
                    model="model",
                    messages=[{"role": "user", "content": "prompt"}],
                    temperature=0.1,
                )

    def test_api_response_strips_think_block_before_fences(self):
        config = {"api_key": "key", "base_url": None, "model": "model"}
        client = Mock()
        client.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(
                content='<think>private reasoning</think>\n```markdoc\n{% slide title="Title" %}\nBody\n{% /slide %}\n```'
            ))]
        )
        with patch.object(extract, "OpenAI", return_value=client), \
                contextlib.redirect_stderr(io.StringIO()):
            result = extract.call_llm_api("prompt", config)
        self.assertEqual(result, '{% slide title="Title" %}\nBody\n{% /slide %}')

    def test_api_request_error_propagates_from_worker(self):
        config = {"api_key": "key", "base_url": None, "model": "model"}
        client = Mock()
        error = APIError("Request failed", request=Mock(headers={}), body=None)
        client.chat.completions.create.side_effect = error
        with patch.object(extract, "OpenAI", return_value=client), \
                contextlib.redirect_stderr(io.StringIO()), \
                self.assertRaises(APIError) as raised:
            extract.call_llm_api("prompt", config)
        self.assertIs(raised.exception, error)

    def test_api_wait_propagates_keyboard_interrupt(self):
        config = {"api_key": "key", "base_url": None, "model": "model"}
        worker = Mock()
        worker.is_alive.return_value = True
        worker.join.side_effect = KeyboardInterrupt
        with patch.object(extract, "OpenAI"), \
                patch.object(extract.threading, "Thread", return_value=worker) as thread, \
                contextlib.redirect_stderr(io.StringIO()), \
                self.assertRaises(KeyboardInterrupt):
            extract.call_llm_api("prompt", config)
        self.assertTrue(thread.call_args.kwargs["daemon"])
        worker.join.assert_called_once_with(timeout=0.2)

    def test_batch_fetches_schema_once_including_fallback(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            input_dir = root / "input"
            input_dir.mkdir()
            paths = []
            for unit in (1, 2):
                path = input_dir / f"{unit} - Unit {unit}.pptx"
                presentation = Presentation()
                presentation.slides.add_slide(presentation.slide_layouts[6])
                presentation.save(path)
                paths.append(str(path))

            for mode, dry_run in (("manual", False), ("manual", True), ("api", True)):
                for response in (b"Schema content", b"", OSError("offline")):
                    with self.subTest(mode=mode, dry_run=dry_run, response=response):
                        extract._llms_schema_context = None
                        extract._llms_schema_error = None
                        stdout = io.StringIO()
                        stderr = io.StringIO()
                        opener = Mock(side_effect=response) if isinstance(response, Exception) else Mock(
                            return_value=io.BytesIO(response)
                        )
                        with patch.object(extract, "INPUT_DIR", str(input_dir)), \
                                patch.object(extract, "LOCAL_IMG_DIR", str(root / "images")), \
                                patch.object(extract.glob, "glob", return_value=paths), \
                                patch.object(extract, "urlopen", opener), \
                                patch.object(extract, "postprocess_and_save"), \
                                patch.object(sys, "stdin", Mock(read=Mock(return_value="Markdoc"))), \
                                contextlib.redirect_stdout(stdout), \
                                contextlib.redirect_stderr(stderr):
                            result = extract.extract_pptx_data(mode, dry_run, {})

                        self.assertEqual(result, 0)
                        opener.assert_called_once_with(extract.LLMS_SCHEMA_URL, timeout=10)
                        expected = "Schema content" if response == b"Schema content" else extract.LLMS_SCHEMA_FALLBACK
                        self.assertEqual(stdout.getvalue().count(f"<schema>\n{expected}\n</schema>"), 2)
                        if expected == extract.LLMS_SCHEMA_FALLBACK:
                            self.assertEqual(stderr.getvalue().count("Could not retrieve llms.txt"), 1)

    def test_api_aborts_when_schema_unavailable(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pptx_path = root / "1 - Example.pptx"
            presentation = Presentation()
            presentation.slides.add_slide(presentation.slide_layouts[6])
            presentation.save(pptx_path)
            second_path = root / "2 - Example.pptx"
            presentation.save(second_path)
            config = {"api_key": "key", "base_url": None, "model": "model"}
            for response in (OSError("offline"), b""):
                for cached_fallback in (False, True):
                    with self.subTest(response=response, cached_fallback=cached_fallback):
                        extract._llms_schema_context = None
                        extract._llms_schema_error = None
                        opener = Mock(side_effect=response) if isinstance(response, Exception) else Mock(
                            return_value=io.BytesIO(response)
                        )
                        stderr = io.StringIO()
                        with patch.object(sys, "argv", ["extract.py", "--api", "--yes"]), \
                                patch.object(extract, "resolve_config", return_value=config), \
                                patch.object(extract, "LOCAL_IMG_DIR", str(root / "images")), \
                                patch.object(extract.glob, "glob", return_value=[str(pptx_path), str(second_path)]), \
                                patch.object(extract, "urlopen", opener), \
                                patch.object(extract, "OpenAI") as client, \
                                patch.object(extract, "postprocess_and_save") as save, \
                                contextlib.redirect_stderr(stderr):
                            if cached_fallback:
                                self.assertEqual(
                                    extract.get_llms_schema_context(allow_fallback=True),
                                    (extract.LLMS_SCHEMA_FALLBACK, False),
                                )
                                stderr.seek(0)
                                stderr.truncate()
                            self.assertEqual(extract.main(), 1)

                        opener.assert_called_once_with(extract.LLMS_SCHEMA_URL, timeout=10)
                        client.assert_not_called()
                        save.assert_not_called()
                        self.assertIn(f"Could not retrieve llms.txt from {extract.LLMS_SCHEMA_URL}", stderr.getvalue())
                        self.assertIn("Aborting --api run", stderr.getvalue())
                        self.assertNotIn("using the manual placeholder", stderr.getvalue())
                        self.assertNotIn("Processing: Unit 2", stderr.getvalue())
                        self.assertIn("offline" if isinstance(response, Exception) else "response was empty", stderr.getvalue())

    def test_interrupt_during_api_wait_aborts_batch(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            input_dir = root / "input"
            input_dir.mkdir()
            paths = []
            for unit in (1, 2):
                path = input_dir / f"{unit} - Unit {unit}.pptx"
                presentation = Presentation()
                presentation.slides.add_slide(presentation.slide_layouts[6])
                presentation.save(path)
                paths.append(str(path))

            started = threading.Event()
            release = threading.Event()
            workers = []
            original_join = threading.Thread.join
            client = Mock()

            def blocked_request(**kwargs):
                started.set()
                release.wait()
                return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Markdoc"))])

            def interrupt_join(worker, timeout=None):
                workers.append(worker)
                self.assertTrue(started.wait(timeout=2))
                self.assertTrue(worker.daemon)
                self.assertEqual(timeout, 0.2)
                raise KeyboardInterrupt

            client.chat.completions.create.side_effect = blocked_request
            stderr = io.StringIO()
            config = {"api_key": "key", "base_url": None, "model": "model"}
            try:
                with patch.object(sys, "argv", ["extract.py", "--api", "--yes"]), \
                        patch.object(extract, "resolve_config", return_value=config), \
                        patch.object(extract, "INPUT_DIR", str(input_dir)), \
                        patch.object(extract, "LOCAL_IMG_DIR", str(root / "images")), \
                        patch.object(extract.glob, "glob", return_value=paths), \
                        patch.object(extract, "urlopen", return_value=io.BytesIO(b"Schema")), \
                        patch.object(extract, "OpenAI", return_value=client), \
                        patch.object(extract.threading.Thread, "join", interrupt_join), \
                        patch.object(extract, "postprocess_and_save") as save, \
                        contextlib.redirect_stderr(stderr):
                    self.assertEqual(extract.main(), 130)
                self.assertEqual(client.chat.completions.create.call_count, 1)
                save.assert_not_called()
                self.assertIn("Extraction cancelled by user.", stderr.getvalue())
                self.assertNotIn("Processing: Unit 2", stderr.getvalue())
                self.assertNotIn("Traceback", stderr.getvalue())
            finally:
                release.set()
                for worker in workers:
                    original_join(worker, timeout=2)
                    self.assertFalse(worker.is_alive())

    def test_card_frame_is_included_in_spatial_prompt(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pptx_path = root / "1 - Example.pptx"
            presentation = Presentation()
            slide = presentation.slides.add_slide(presentation.slide_layouts[6])
            frame = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE,
                Inches(1),
                Inches(2),
                Inches(4),
                Inches(3),
            )
            frame.line.color.rgb = RGBColor(0, 0, 0)
            presentation.save(pptx_path)
            with patch.object(sys, "argv", ["extract.py", "--dry-run", "--file", str(pptx_path)]), \
                    patch.object(sys.stdin, "isatty", return_value=False), \
                    patch.object(extract, "resolve_config", return_value={}), \
                    patch.object(extract, "LOCAL_IMG_DIR", str(root / "images")), \
                    patch.object(extract, "urlopen", side_effect=OSError("offline")), \
                    contextlib.redirect_stdout(io.StringIO()) as stdout, \
                    contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(extract.main(), 0)
            self.assertRegex(
                stdout.getvalue(),
                r"\[X:0\.30, Y:0\.47, W:0\.40, H:0\.40\] CardFrame: \[Rectangle_1\]",
            )

    def test_postprocessing_saves_frontmatter_images_and_deduplicated_titles(self):
        response = (
            '{% slide title="First title" %}\n### First title\n'
            '![image.png]()\n{% /slide %}\n'
            '{% slide title="Second title" %}\n**Second title**\n'
            '![other.jpg](old-path)\n{% /slide %}'
        )
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            images = root / "extracted"
            images.mkdir()
            (images / "image.png").write_bytes(b"image")
            with patch.object(extract, "CONTENT_DIR", str(root / "content")), \
                    patch.object(extract, "ASSETS_DIR", str(root / "assets")), \
                    contextlib.redirect_stderr(io.StringIO()):
                extract.postprocess_and_save(response, "8.2", "Example", "8-2", str(images))
            result = (root / "content" / "8-2.mdoc").read_text(encoding="utf-8")
            self.assertTrue(result.startswith("---\nunit: '8.2'\ntitle: 'Example'\n---\n\n"))
            self.assertNotIn("### First title", result)
            self.assertNotIn("**Second title**", result)
            self.assertIn("![image.png](@admin-assets/images/courses/8-2/image.png)", result)
            self.assertIn("![other.jpg](@admin-assets/images/courses/8-2/other.jpg)", result)
            self.assertEqual((root / "assets" / "8-2" / "image.png").read_bytes(), b"image")

    def test_postprocessing_repairs_attribute_quotes_and_resolves_tag_images(self):
        response = (
            "{% slide title=\"GAME: \"We're meeting for drinks at 7 pm\"\" %}\n"
            '{% question prompt="Choose "yes" or no" image="slide_3_Freeform_8.png" '
            'answers=[{text: "Yes", isCorrect: true, image: "slide_3_icon.png"}] %}\n'
            '{% /slide %}'
        )
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            images = root / "extracted"
            images.mkdir()
            with patch.object(extract, "CONTENT_DIR", str(root / "content")), \
                    patch.object(extract, "ASSETS_DIR", str(root / "assets")), \
                    contextlib.redirect_stderr(io.StringIO()):
                extract.postprocess_and_save(response, "8.2", "Example", "8-2", str(images))
            result = (root / "content" / "8-2.mdoc").read_text(encoding="utf-8")
            asset_path = "@admin-assets/images/courses/8-2/"
            self.assertIn(
                "title=\"GAME: \\\"We're meeting for drinks at 7 pm\\\"\"",
                result,
            )
            self.assertIn('prompt="Choose \\"yes\\" or no"', result)
            self.assertIn(f'image="{asset_path}slide_3_Freeform_8.png"', result)
            self.assertIn(f'image: "{asset_path}slide_3_icon.png"', result)

    def test_api_error_does_not_stop_batch(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            input_dir = root / "input"
            input_dir.mkdir()
            for unit in (1, 2):
                presentation = Presentation()
                slide = presentation.slides.add_slide(presentation.slide_layouts[6])
                slide.shapes.add_textbox(100000, 100000, 3000000, 500000).text = f"Slide {unit}"
                presentation.save(input_dir / f"{unit} - Unit {unit}.pptx")
            paths = [str(input_dir / f"{unit} - Unit {unit}.pptx") for unit in (1, 2)]
            error = APIError("Request timed out", request=Mock(headers={}), body=None)
            stderr = io.StringIO()
            with patch.object(extract, "INPUT_DIR", str(input_dir)), \
                    patch.object(extract, "LOCAL_IMG_DIR", str(root / "images")), \
                    patch.object(extract.glob, "glob", return_value=paths), \
                    patch.object(extract, "urlopen", return_value=io.BytesIO(b"Schema")), \
                    patch.object(extract, "call_llm_api", side_effect=[error, "Markdoc"]) as api, \
                    patch.object(extract, "postprocess_and_save") as save, \
                    contextlib.redirect_stdout(io.StringIO()) as stdout, \
                    contextlib.redirect_stderr(stderr):
                result = extract.extract_pptx_data("api", False, {})
            self.assertEqual(result, 0)
            self.assertEqual(api.call_count, 2)
            save.assert_called_once_with("Markdoc", "2", "Unit 2", "2", str(root / "images" / "2"))
            self.assertIn("LLM API request failed for 1 - Unit 1.pptx", stderr.getvalue())
            self.assertEqual(stdout.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
