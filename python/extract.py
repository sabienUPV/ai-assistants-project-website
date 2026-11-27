import argparse
import getpass
import os
import glob
import queue
import re
import sys
import shutil
import threading
from pathlib import Path
from urllib.request import urlopen
from dotenv import load_dotenv
from openai import APIError, OpenAI
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

# --- Configuration ---
INPUT_DIR = "input"
LOCAL_IMG_DIR = os.path.join(INPUT_DIR, "extracted_images")

# Astro project relative paths
ASSETS_DIR = "../packages/admin/src/assets/images/courses"
CONTENT_DIR = "../packages/admin/src/content/en/courses"

LLMS_SCHEMA_URL = "https://ai4pid.eu/llms.txt"
LLMS_SCHEMA_FALLBACK = "[MANUALLY PASTE THE CONTENT OF YOUR llms.txt HERE]"
_llms_schema_context = None
_llms_schema_error = None

LOGO_Y_THRESHOLD_TITLE = 0.15  # Upper 15% of the slide to filter out header logos in title slide (first slide)
LOGO_Y_THRESHOLD_CONTENT = 0.05  # Upper 5% of the slide to filter out header logos in content slides (subsequent slides)

# Configurable keywords to identify and skip redundant slides (case-insensitive)
SKIP_SLIDE_KEYWORDS = [
    "BY-NC-SA",
    "EACEA",
    "Consortium"
]


def build_parser():
    parser = argparse.ArgumentParser(
        description="Extract PowerPoint slides and convert them to Markdoc."
    )
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--api", action="store_true", help="Generate Markdoc using the LLM API.")
    mode_group.add_argument("--manual", action="store_true", help="Print prompts and read responses from stdin.")
    parser.add_argument("--api-key", help="Override LLM_API_KEY.")
    parser.add_argument("--base-url", help="Override LLM_BASE_URL.")
    parser.add_argument("--model", help="Override LLM_MODEL.")
    parser.add_argument("-f", "--file", help="Process one .pptx file instead of scanning input/.")
    parser.add_argument("-y", "--yes", action="store_true", help="Run without interactive prompts.")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without calling the API or saving files.")
    return parser


def resolve_config(args):
    script_dir = Path(__file__).resolve().parent
    for env_path in (script_dir / ".env", script_dir.parent / ".env"):
        if env_path.is_file():
            load_dotenv(env_path)
            break

    return {
        "api_key": args.api_key or os.getenv("LLM_API_KEY"),
        "base_url": args.base_url or os.getenv("LLM_BASE_URL"),
        "model": args.model or os.getenv("LLM_MODEL"),
    }


def read_stderr_input(prompt):
    print(prompt, end="", file=sys.stderr, flush=True)
    return sys.stdin.readline().strip()


def interactive_menu():
    print("\nChoose an execution mode:", file=sys.stderr)
    print("  1. API Mode (Automated)", file=sys.stderr)
    print("  2. Manual Mode (Copy prompt and paste response)", file=sys.stderr)
    while True:
        choice = read_stderr_input("Select 1 or 2: ")
        if choice == "1":
            return "api"
        if choice == "2":
            return "manual"
        print("Please enter 1 or 2.", file=sys.stderr)


def mask_api_key(api_key):
    if len(api_key) <= 4:
        return "*" * len(api_key)
    return f"{api_key[:3]}****{api_key[-4:]}"


def configure_api(args, config):
    interactive = sys.stdin.isatty() and not args.yes
    complete_config = all(config.values())
    edit_requested = False

    if interactive and complete_config:
        print("\nResolved LLM configuration:", file=sys.stderr)
        print(f"  API key: {mask_api_key(config['api_key'])}", file=sys.stderr)
        print(f"  Base URL: {config['base_url']}", file=sys.stderr)
        print(f"  Model: {config['model']}", file=sys.stderr)
        choice = read_stderr_input(
            "Use this configuration? [Y/n] (or 'e' to edit/override manually): "
        ).lower()
        if choice in ("", "y", "yes"):
            return config
        if choice not in ("e", "edit", "n", "no"):
            print("Using the resolved configuration.", file=sys.stderr)
            return config
        edit_requested = True

    if not interactive:
        missing = [name for name in ("api_key", "model") if not config[name]]
        if missing:
            raise ValueError(
                "Missing required API configuration: "
                + ", ".join(missing)
                + ". Set the corresponding LLM_* variable or pass a CLI override."
            )
        return config

    if (not config["api_key"] or edit_requested) and args.api_key is None:
        current = "configured; press Enter to keep it" if config["api_key"] else "required"
        entered = getpass.getpass(f"LLM API key ({current}): ")
        if entered:
            config["api_key"] = entered

    if (not config["base_url"] or edit_requested) and args.base_url is None:
        entered = read_stderr_input(
            f"LLM base URL [{config['base_url'] or 'OpenAI default'}]: "
        )
        if entered:
            config["base_url"] = entered

    if (not config["model"] or edit_requested) and args.model is None:
        entered = read_stderr_input(f"LLM model [{config['model'] or 'required'}]: ")
        if entered:
            config["model"] = entered

    missing = [name for name in ("api_key", "model") if not config[name]]
    if missing:
        raise ValueError("Missing required API configuration: " + ", ".join(missing) + ".")
    return config


def get_llms_schema_context(allow_fallback=False):
    global _llms_schema_context, _llms_schema_error
    if _llms_schema_context is None and _llms_schema_error is None:
        try:
            with urlopen(LLMS_SCHEMA_URL, timeout=10) as response:
                content = response.read().decode("utf-8").strip()
            if not content:
                raise ValueError("The llms.txt response was empty")
            _llms_schema_context = (content, True)
        except Exception as error:
            _llms_schema_error = str(error)

    if _llms_schema_error is not None:
        if not allow_fallback:
            raise ValueError(
                f"Could not retrieve llms.txt from {LLMS_SCHEMA_URL} ({_llms_schema_error}). "
                "Aborting --api run so the manual placeholder is not sent to the LLM."
            )
        if _llms_schema_context is None:
            print(
                f"⚠️ Could not retrieve llms.txt ({_llms_schema_error}); using the manual placeholder.",
                file=sys.stderr,
            )
            _llms_schema_context = (LLMS_SCHEMA_FALLBACK, False)

    return _llms_schema_context


def call_llm_api(prompt_text, config):
    client_options = {"api_key": config["api_key"]}
    if config["base_url"]:
        client_options["base_url"] = config["base_url"]
    client = OpenAI(**client_options)
    print(f"🤖 Sending slides to {config['model']}...", file=sys.stderr)
    results = queue.SimpleQueue()

    def request():
        try:
            response = client.chat.completions.create(
                model=config["model"],
                messages=[{"role": "user", "content": prompt_text}],
                temperature=0.1,
            )
        except BaseException as error:
            # Propagate worker failures, including interrupts, on the main thread.
            results.put((False, error))
        else:
            results.put((True, response))

    worker = threading.Thread(target=request, daemon=True)
    worker.start()
    while worker.is_alive():
        worker.join(timeout=0.2)

    succeeded, response = results.get_nowait()
    if not succeeded:
        raise response

    content = response.choices[0].message.content
    if not content:
        raise ValueError("The LLM API returned an empty response.")

    content = content.strip()
    content = re.sub(
        r"\A(?:\s*<think>.*?</think>\s*)+",
        "",
        content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    content = re.sub(r"\A```(?:markdoc|markdown)?[ \t]*\r?\n", "", content, flags=re.IGNORECASE)
    content = re.sub(r"\r?\n?```[ \t]*\Z", "", content)
    return content.strip()


def sanitize_markdoc_tags(mdoc_text):
    """Escape unescaped double quotes inside top-level Markdoc string attributes."""
    def sanitize_tag(match):
        tag = match.group(0)
        body_start = tag.find(" ") + 1
        body_end = tag.rfind("%}")
        body = tag[body_start:body_end]
        result = []
        index = 0
        nesting = 0

        while index < len(body):
            attribute = re.match(r"[A-Za-z_][\w-]*\s*[:=]\s*\"", body[index:])
            if attribute and nesting == 0:
                opening_quote = index + attribute.end() - 1
                closing_quote = None
                for candidate in range(opening_quote + 1, len(body)):
                    if body[candidate] != '"' or _is_escaped(body, candidate):
                        continue
                    remainder = body[candidate + 1:]
                    if (
                        re.match(r"\s*[A-Za-z_][\w-]*\s*[:=]", remainder)
                        or not remainder.strip()
                    ):
                        closing_quote = candidate
                        break

                if closing_quote is not None:
                    result.append(body[index:opening_quote + 1])
                    for quote_index in range(opening_quote + 1, closing_quote):
                        char = body[quote_index]
                        if char == '"' and not _is_escaped(body, quote_index):
                            result.append("\\")
                        result.append(char)
                    result.append('"')
                    index = closing_quote + 1
                    continue

            char = body[index]
            result.append(char)
            if char in "[{(":
                nesting += 1
            elif char in "]})":
                nesting = max(0, nesting - 1)
            elif char == '"' and nesting > 0:
                next_quote = index + 1
                while next_quote < len(body):
                    if body[next_quote] == '"' and not _is_escaped(body, next_quote):
                        break
                    next_quote += 1
                if next_quote < len(body):
                    result.extend(body[index + 1:next_quote + 1])
                    index = next_quote
            index += 1

        return tag[:body_start] + "".join(result) + tag[body_end:]

    return re.sub(r"\{%.*?%\}", sanitize_tag, mdoc_text, flags=re.DOTALL)


def _is_escaped(text, index):
    backslashes = 0
    index -= 1
    while index >= 0 and text[index] == "\\":
        backslashes += 1
        index -= 1
    return backslashes % 2 == 1


def postprocess_and_save(llm_output, unit_str, title_str, unit_folder, output_img_dir):
    # --- POST-PROCESSING ---

    # 1. Resolve extracted image paths in Markdown and Markdoc attributes.
    astro_asset_path = f"@admin-assets/images/courses/{unit_folder}"
    processed_mdoc = re.sub(
        r'!\[([^\]]+)\]\([^\)]*\)',
        rf'![\1]({astro_asset_path}/\1)',
        llm_output
    )
    extracted_image = r"slide_\d+_[^\"'\s]+\.(?:png|jpe?g|gif|webp|svg)"
    processed_mdoc = re.sub(
        rf'(\bimage\s*[:=]\s*")({extracted_image})(")',
        rf'\1{astro_asset_path}/\2\3',
        processed_mdoc,
        flags=re.IGNORECASE,
    )
    processed_mdoc = sanitize_markdoc_tags(processed_mdoc)

    # 2. Remove Redundant Slide Titles
    # The LLM may have repeated the slide title at the top of the slide content.
    def clean_slide(match):
        full_slide = match.group(0)
        title = match.group(1).replace(r'\"', '"').strip()

        # Regex to match either titles (e.g., ### Title) or emphasized/bolded titles (e.g., **Title**) at the start of the slide content, allowing for optional whitespace and newlines
        # Regex explanation:
        # - (%}}\s*) : Captures the closing slide tag and any whitespace after it
        # - (?:#|\*)* : Non-capturing group to match any number of '#' or '* characters (for titles, emphasized or bolded text)
        # - \s*{re.escape(title)}\s* : Matches the slide title with optional whitespace around it
        # - (?:\*)* : Optionally matches closing '*' characters (any number of them, for both '*' and '**') in case the title was bolded or emphasized
        # - \n+ : Matches one or more newlines after the title
        pattern = rf'(%}}\s*)(?:#|\*)*\s*{re.escape(title)}\s*(?:\*)*\s*\n+'
        cleaned_content = re.sub(pattern, r'\1', full_slide, flags=re.IGNORECASE)
        return cleaned_content

    # Capture the entire slide block and its title for processing
    # Regex explanation:
    # - {%\s*slide\s+title="([^"]+)"[^%]*%} : Matches the opening slide tag and captures the title
    # - .*? : Non-greedy match for any content inside the slide
    # - {%\s*/slide\s*%} : Matches the closing slide tag
    slide_pattern = r'{%\s*slide\s+title="((?:\\.|[^"\\])*)"[^%]*%}.*?{%\s*/slide\s*%}'
    processed_mdoc = re.sub(slide_pattern, clean_slide, processed_mdoc, flags=re.DOTALL)

    # 3. Append Frontmatter
    frontmatter = f"---\nunit: '{unit_str}'\ntitle: '{title_str}'\n---\n\n"
    final_mdoc = frontmatter + processed_mdoc

    # 3. Save the final .mdoc file
    os.makedirs(CONTENT_DIR, exist_ok=True)
    mdoc_file_path = os.path.join(CONTENT_DIR, f"{unit_folder}.mdoc")
    with open(mdoc_file_path, "w", encoding="utf-8") as f:
        f.write(final_mdoc)
    print(f"✔️ Saved final Markdoc to: {mdoc_file_path}", file=sys.stderr)

    # 4. Copy images to the Astro assets directory
    final_img_dir = os.path.join(ASSETS_DIR, unit_folder)
    os.makedirs(final_img_dir, exist_ok=True)

    copied_count = 0
    for img_file in os.listdir(output_img_dir):
        src_path = os.path.join(output_img_dir, img_file)
        dest_path = os.path.join(final_img_dir, img_file)
        shutil.copy2(src_path, dest_path)
        copied_count += 1

    print(f"✔️ Copied {copied_count} images to: {final_img_dir}", file=sys.stderr)
    print(f"🎉 Unit {unit_str} fully processed and integrated!", file=sys.stderr)


def extract_rich_text(shape):
    """
    Extracts text from a shape while preserving line breaks and 
    translating native PowerPoint bold formatting to Markdown.
    Merges consecutive bold runs to prevent fragmentation (e.g. **w** **o** **rd**).
    """
    if not getattr(shape, "has_text_frame", False) or not shape.has_text_frame:
        return ""
        
    paragraphs_text = []
    for p in shape.text_frame.paragraphs:
        p_text = ""
        merged_runs = []
        
        # 1. Merge consecutive runs with the same bold formatting
        for run in p.runs:
            if not run.text:
                continue
            
            is_bold = bool(run.font.bold)
            
            if merged_runs and merged_runs[-1]['bold'] == is_bold:
                merged_runs[-1]['text'] += run.text
            else:
                merged_runs.append({'text': run.text, 'bold': is_bold})
                
        # 2. Apply markdown formatting to the merged runs
        for item in merged_runs:
            text = item['text']
            if item['bold'] and text.strip():
                # Extract surrounding whitespace to place the markdown tags tightly around the word
                stripped = text.strip()
                left_space = text[:len(text)-len(text.lstrip())]
                right_space = text[len(text.rstrip()):]
                p_text += f"{left_space}**{stripped}**{right_space}"
            else:
                p_text += text
                
        cleaned_p_text = p_text.strip()
        if cleaned_p_text:
            # If the paragraph has a level > 0, it was likely a sub-list in PPT.
            # We add a hyphen to help the LLM identify it as a bullet point.
            if p.level > 0:
                cleaned_p_text = f"- {cleaned_p_text}"
            paragraphs_text.append(cleaned_p_text)
            
    return " \\n ".join(paragraphs_text)


def extract_pptx_data(mode, dry_run, config, selected_file=None):
    """
    Extract slide text and images, then route generated prompts through the chosen mode.
    """
    # Find all .pptx files, ignoring Microsoft Office temporary lock files (~$)
    if selected_file:
        candidate = Path(selected_file)
        if not candidate.is_file():
            candidate = Path(INPUT_DIR) / selected_file
        if not candidate.is_file() or candidate.suffix.lower() != ".pptx":
            print(f"❌ Input file not found or is not a .pptx file: {selected_file}", file=sys.stderr)
            return 1
        pptx_files = [str(candidate)]
    else:
        pptx_files = [
            f for f in glob.glob(os.path.join(INPUT_DIR, "*.pptx"))
            if not os.path.basename(f).startswith("~$")
        ]

    if not pptx_files:
        print(f"⚠️ No valid .pptx files found in '{INPUT_DIR}'.", file=sys.stderr)
        return 0

    # Regex to enforce patterns like: "8 - Name.pptx", "8.2 - Name.pptx", "8.2.1 - Name.pptx", etc.
    filename_pattern = re.compile(r'^(?P<unit>\d+(?:\.\d+)*)\s*-\s*(?P<title>.+)\.pptx$')

    for pptx_path in pptx_files:
        filename = os.path.basename(pptx_path)
        
        match = filename_pattern.match(filename)
        if not match:
            print(f"⚠️ SKIPPED: '{filename}' does not match the 'Unit - Title.pptx' format (e.g. '8.2 - Social participation.pptx')", file=sys.stderr)
            continue
            
        unit_str = match.group('unit')      # e.g., "8.2"
        title_str = match.group('title')    # e.g., "Social participation and AI"
        unit_folder = unit_str.replace('.', '-') # e.g., "8-2"
        
        print(f"\n{'='*60}", file=sys.stderr)
        print(f"🚀 Processing: Unit {unit_str} - {title_str}", file=sys.stderr)
        print(f"{'='*60}", file=sys.stderr)
        
        # Local temp directory for images before post-processing
        output_img_dir = os.path.join(LOCAL_IMG_DIR, unit_folder)
        os.makedirs(output_img_dir, exist_ok=True)
        
        spatial_data_output = []

        try:
            prs = Presentation(pptx_path)
            slide_width = prs.slide_width
            slide_height = prs.slide_height

            for i, slide in enumerate(prs.slides):
                # Determine logo filter threshold based on slide index
                logo_threshold = LOGO_Y_THRESHOLD_TITLE if i == 0 else LOGO_Y_THRESHOLD_CONTENT
                
                # --- 1. PRE-SCAN: Check for skip keywords ---
                def get_full_slide_text(shape):
                    """Recursively aggregates all text from a shape and its grouped children."""
                    text = ""
                    if getattr(shape, 'shape_type', None) == MSO_SHAPE_TYPE.GROUP:
                        for sub_shape in shape.shapes:
                            text += get_full_slide_text(sub_shape)
                        return text
                    
                    if getattr(shape, "has_text_frame", False) and shape.has_text_frame:
                        text += " ".join([p.text.strip() for p in shape.text_frame.paragraphs]) + " "
                    return text

                full_slide_text = ""
                for shape in slide.shapes:
                    full_slide_text += get_full_slide_text(shape)
                
                skip_slide_checks = [(kw, kw.lower() in full_slide_text.lower()) for kw in SKIP_SLIDE_KEYWORDS]
                
                if any([x[1] for x in skip_slide_checks]):
                    matched_keywords = [x[0] for x in skip_slide_checks if x[1]]
                    print(f"⏭️ Skipping slide {i+1} (Matched keywords: {matched_keywords})", file=sys.stderr)
                    continue
                # --------------------------------------------

                print(f"⚙️ Parsing Slide {i+1}...", file=sys.stderr)
                spatial_data_output.append(f"\n--- SLIDE {i + 1} ---")
                elements = []
                
                # --- 2. EXTRACTION: Process shapes and physical images ---
                def process_shape(shape):
                    """
                    Recursively processes shapes, extracting rich text, native pictures, 
                    and hidden blipFill image blobs.
                    """
                    # Handle grouped shapes by entering them recursively
                    if getattr(shape, 'shape_type', None) == MSO_SHAPE_TYPE.GROUP:
                        for sub_shape in shape.shapes:
                            process_shape(sub_shape)
                        return

                    # Ignore elements missing dimensional data
                    if not all(hasattr(shape, attr) for attr in ['top', 'left', 'width', 'height']):
                        return
                        
                    # Calculate center relative coordinates (0.0 to 1.0) for accurate alignment
                    center_x = (shape.left + (shape.width / 2)) / slide_width
                    center_y = (shape.top + (shape.height / 2)) / slide_height
                    top_y = shape.top / slide_height  # Kept strictly for the top-logo filter
                    
                    shape_type = getattr(shape, 'shape_type', None)
                    name = getattr(shape, 'name', 'Element').replace(" ", "_")
                    
                    text_content = extract_rich_text(shape)
                    
                    # LOGO FILTER: Ignore visual elements in the upper threshold (using absolute top)
                    if top_y < logo_threshold and not text_content:
                        return
                        
                    if text_content:
                        elements.append({
                            "type": "Text", 
                            "content": text_content, 
                            "x": center_x, 
                            "y": center_y
                        })
                    else:
                        blob = None
                        ext = "png"
                        
                        # 2A. Standard rasterized image (<p:pic>)
                        if shape_type == MSO_SHAPE_TYPE.PICTURE or hasattr(shape, "image"):
                            blob = shape.image.blob
                            ext = getattr(shape.image, "ext", "png")
                            
                        # 2B. Vector shape with a hidden image fill (Picture Fill) OR horizontal separator line
                        elif shape_type in [MSO_SHAPE_TYPE.FREEFORM, MSO_SHAPE_TYPE.AUTO_SHAPE, MSO_SHAPE_TYPE.LINE]:
                            if hasattr(shape, "fill") and getattr(shape.fill, "type", None) == 6:
                                try:
                                    # Navigate XML tree to find the relation ID (rId)
                                    blips = shape._element.xpath('.//a:blip')
                                    if blips:
                                        rId = blips[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                                        if rId:
                                            # Extract raw physical file via SlidePart relationships
                                            rel = shape.part.rels[rId]
                                            image_part = rel.target_part
                                            blob = image_part.blob
                                            
                                            # Attempt to extract actual extension from content type
                                            c_type = getattr(image_part, "content_type", "")
                                            ext = c_type.split('/')[-1] if '/' in c_type else "png"
                                except Exception as e:
                                    print(f"⚠️ Could not extract physical image from {name}: {e}", file=sys.stderr)
                            else:
                                # Check if it's a horizontal line
                                rel_width = shape.width / slide_width
                                rel_height = shape.height / slide_height

                                # A horizontal line is usually wide (> 15% of slide) and thin (< 2% height)
                                if rel_width > 0.15 and rel_height < 0.02:
                                    elements.append({
                                        "type": "Separator", 
                                        "content": "---", 
                                        "x": center_x, 
                                        "y": center_y
                                    })
                                elif (
                                    shape_type in [MSO_SHAPE_TYPE.FREEFORM, MSO_SHAPE_TYPE.AUTO_SHAPE]
                                    and hasattr(shape, "line")
                                    and getattr(getattr(shape.line, "fill", None), "type", None) == 1
                                    and rel_width > 0.15
                                    and rel_height > 0.15
                                ):
                                    elements.append({
                                        "type": "CardFrame",
                                        "content": f"[{name}]",
                                        "x": center_x,
                                        "y": center_y,
                                        "width": rel_width,
                                        "height": rel_height,
                                    })
                                else:
                                    # Pure vector path without image fill, and not a horizontal line. We just include a placeholder with the type of element for the LLM to handle.
                                    elements.append({"type": "Vector", "content": f"[{name}]", "x": center_x, "y": center_y})
                        
                        # If a binary image was successfully extracted, save it locally first
                        if blob:
                            image_name = f"slide_{i+1}_{name}.{ext}"
                            image_path = os.path.join(output_img_dir, image_name)
                            
                            with open(image_path, "wb") as f:
                                f.write(blob)
                                
                            # Prepare clean Markdown image syntax for LLM context (paths resolved in post-processing)
                            elements.append({
                                "type": "Image", 
                                "content": f"![{image_name}]()", 
                                "x": center_x, 
                                "y": center_y
                            })

                for shape in slide.shapes:
                    process_shape(shape)

                # Sort spatially by center point: top-to-bottom (Y), then left-to-right (X)
                elements.sort(key=lambda e: (round(e["y"], 2), e["x"]))

                for el in elements:
                    if el["type"] == "CardFrame":
                        spatial_data_output.append(
                            f"[X:{el['x']:.2f}, Y:{el['y']:.2f}, "
                            f"W:{el['width']:.2f}, H:{el['height']:.2f}] "
                            f"CardFrame: {el['content']}"
                        )
                    else:
                        spatial_data_output.append(
                            f"[X:{el['x']:.2f}, Y:{el['y']:.2f}] "
                            f"{el['type']}: {el['content']}"
                        )

        except Exception as e:
            print(f"❌ Error processing {filename}: {e}", file=sys.stderr)
            continue
            
        # --- GENERATE PROMPT (stdout) ---
        schema_content, schema_found = get_llms_schema_context(
            allow_fallback=(mode == "manual" or dry_run)
        )

        prompt_text = f"""System Role:
You are an expert frontend developer and content architect. Your task is to convert a spatial coordinate map extracted from PowerPoint slides into a structured Markdoc (.mdoc) file for an e-training platform.

Context & Schema:
Below is the schema and custom tags you must use. 

<schema>
{schema_content}
</schema>

Spatial Mapping Rules:
You will receive raw data representing elements on slides. Each element has an [X, Y] coordinate representing its geometric center (0.0 to 1.0). 
* X=0.0 is the far left, X=1.0 is the far right. 
* Y=0.0 is the top, Y=1.0 is the bottom.

You must apply these logical rules to build the Markdoc layout:

1. Attribute Quote Safety: If a slide title or any attribute value contains a double quote (`"`), escape each inner quote as `\\\"` and keep the opening and closing attribute quotes unescaped. For example: `title="GAME: \\\"We're meeting for drinks at 7 pm\\\""`.
2. Slideshow Wrapping: Wrap the output in a single {{% slideshow %}} component. By default, wrap each `--- SLIDE X ---` in a {{% slide title="[Extracted Title]" %}} tag. Quiz merging described in Rule 11 is the exception to the one-slide-to-one-Markdoc-slide rule. The title is usually the text element with the lowest Y value.
3. Column Layouts (The X Axis): If you detect elements positioned on opposite sides of the screen (e.g., an image at X:0.10 and text at X:0.50), use the {{% columns %}} and {{% column %}} tags to recreate the visual layout.
4. Paragraph Splitting (The Y Axis): A text block may contain multiple paragraphs separated by ` \\n `. If multiple images are stacked vertically on one side (different Y values) and a single multi-paragraph text block is on the other, split the text block by `\\n` and pair each paragraph with its corresponding image (based on similar Y heights) inside separate {{% columns %}} blocks.
5. Verbatim Easy Read Paragraph Spacing - CRITICAL: NEVER rewrite, paraphrase, summarize, add, or omit any words from the source text. Separate every standalone sentence, paragraph, and lead-in with a blank line (`\\n\\n`) so Markdoc renders distinct `<p>` blocks for Easy Read accessibility. For mid-sentence line wraps where ` \\n ` splits an incomplete sentence across lines (for example, `"Say what you **need,** the **place** and \\n the **time**"`), join the lines into one continuous sentence with a single space. Keep bullet lists (`- ...`) grouped together, with blank lines before and after each list.
6. Rich Text Preservation: Preserve Markdown bold (`**text**`) and bullets (`- text`) from the extracted text exactly in the final output.
7. Images: Render images using standard Markdown syntax based on the input data. Do not alter filenames.
8. Title Deduplication: Once a text block is used as the slide's `title` attribute, do not repeat it inside the slide body (for example, do not write `### Title` or `**Title**` at the top).
9. Full-Width Interactive Components: Interactive components (e.g., `{{% textInput %}}`, `{{% quiz %}}`) and any immediate action prompt or challenge text directly preceding them (e.g., "**Your challenge:** ...") must never be placed inside a `{{% column %}}`. If the slide uses `{{% columns %}}` for context or images, close the columns block before rendering the action prompt and interactive component, keeping them at the slide root.
10. Semantic Flashcard Conversion: When a slide represents cards (for example, a title containing "card" or "cards" such as "Need cards" or "Problem card", elements grouped inside `CardFrame` bounds, or 2–4 parallel columns each containing a small image/icon and a short bold phrase), wrap each card's content in a `{{% flashcard %}}` inside its corresponding `{{% column %}}`.
11. Semantic Quiz Merging: When slides form an evaluation quiz or sequential `Question N` / `True or False N` followed by `Answer N` slides, merge all question/answer pairs into a single `{{% quiz %}}` block placed directly inside `{{% slideshow %}}` (DO NOT wrap `{{% quiz %}}` inside a `{{% slide %}}` tag, because each `{{% question %}}` renders its own slide). Map the question's main illustration to the question's `image` attribute. Set `isCorrect` from the Answer slide and place any extra feedback text from that slide in the correct answer's `explanation`. Never attach an image from an `Answer N` slide to only one answer choice, because that reveals the correct answer before the learner clicks. Only set `answers[].image` when every option has a corresponding choice pictogram, such as using the shared True and False icons from the instructions slide for every option with that text; otherwise omit `answers[].image` for all options. This is the exception to Rule 2's one-to-one slide mapping.

Input Data:
Process the following slides and generate the clean Markdoc code. Do not include explanations, just output the .mdoc code.

<input>
{chr(10).join(spatial_data_output)}
</input>
"""

        print("\n" + "="*60, file=sys.stderr)
        print("✅ Parsing complete! Generated prompt for LLM.", file=sys.stderr)
        if mode == "manual" or dry_run:
            print("Copy the text below (stdout) and paste it into your LLM.", file=sys.stderr)
        if schema_found:
            print("The schema was successfully retrieved from " + LLMS_SCHEMA_URL, file=sys.stderr)
        else:
            print("⚠️ The schema could not be retrieved; You need to manually paste it into the prompt BEFORE submitting it to the LLM.", file=sys.stderr)
        print("="*60 + "\n", file=sys.stderr)
        
        if mode == "manual" or dry_run:
            print(prompt_text)
            sys.stdout.flush()

        if dry_run:
            continue

        if mode == "api":
            try:
                llm_output = call_llm_api(prompt_text, config)
            except APIError as e:
                print(f"❌ LLM API request failed for {filename}: {e}", file=sys.stderr)
                continue
            except ValueError as e:
                print(f"❌ LLM response failed for {filename}: {e}", file=sys.stderr)
                continue
        else:
            # --- WAIT FOR USER INPUT ---
            print("\n" + "="*60, file=sys.stderr)
            print("📥 Paste the LLM's Markdoc response here.", file=sys.stderr)
            print("Press Enter, then either Ctrl+D (Linux/macOS) or Ctrl+Z then Enter again (Windows) when finished.", file=sys.stderr)
            print("="*60, file=sys.stderr)

            # Read input, remove leftover Windows EOF characters (Ctrl+Z), and strip whitespace
            llm_output = sys.stdin.read().replace('\x1a', '').strip()
        
        if not llm_output:
            print("⚠️ No output provided. Skipping post-processing for this file.", file=sys.stderr)
            continue
            
        print("\n🔄 Starting post-processing...", file=sys.stderr)
        postprocess_and_save(llm_output, unit_str, title_str, unit_folder, output_img_dir)

    return 0

def main():
    try:
        parser = build_parser()
        cli_args = parser.parse_args()
        resolved_config = resolve_config(cli_args)

        if cli_args.api:
            selected_mode = "api"
        elif cli_args.manual or cli_args.dry_run:
            selected_mode = "manual"
        elif cli_args.yes:
            print("--yes requires an explicit --api or --manual mode.", file=sys.stderr)
            return 1
        elif sys.stdin.isatty():
            selected_mode = interactive_menu()
        else:
            parser.error("Choose --api or --manual when stdin is not interactive.")

        if selected_mode == "api" and not cli_args.dry_run:
            resolved_config = configure_api(cli_args, resolved_config)
        exit_code = extract_pptx_data(
            selected_mode,
            cli_args.dry_run,
            resolved_config,
            cli_args.file,
        )
    except KeyboardInterrupt:
        print("\n⚠️ Extraction cancelled by user.", file=sys.stderr)
        exit_code = 130
    except (ValueError, APIError) as error:
        print(f"❌ {error}", file=sys.stderr)
        exit_code = 1
    return exit_code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n⚠️ Extraction cancelled by user.", file=sys.stderr)
        sys.exit(130)