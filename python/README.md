# Python tools

Activate the virtual environment:

```powershell
# Windows:
.venv\Scripts\Activate.ps1
```
```shell
# macOS/Linux:
source .venv/bin/activate
```

Run the extraction script from this directory. Use `--dry-run` to print prompts
without choosing a mode or writing final content:

```powershell
.\extract.ps1 --dry-run
```

The `llms.txt` schema is fetched once per process and reused for all files.
If retrieval fails in manual or dry-run mode, the manual placeholder is reused
until the next run. In API mode, retrieval failure aborts the run rather than
sending the placeholder to the LLM.
Press Ctrl+C to stop the batch, including while waiting for an LLM response.
The in-flight request may still complete on the server.

Run the unit tests on Windows with `.\test.ps1`. The runner creates a virtual
environment if needed and installs the existing requirements before testing.