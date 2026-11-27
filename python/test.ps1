$venvPath = Join-Path -Path $PSScriptRoot -ChildPath ".venv\Scripts\Activate.ps1"

Push-Location $PSScriptRoot
try {
    if (-not (Test-Path $venvPath)) {
        Write-Host "Virtual environment not found. Creating a new one..."
        python -m venv .venv
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    Write-Host "Activating virtual environment..."
    & $venvPath

    Write-Host "Installing required packages..."
    python -m pip install -q -r requirements.txt
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    python -m unittest discover -s tests -v
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
