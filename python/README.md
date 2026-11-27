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

Run the unit tests on Windows with `.\test.ps1`. The runner creates a virtual
environment if needed and installs the existing requirements before testing.