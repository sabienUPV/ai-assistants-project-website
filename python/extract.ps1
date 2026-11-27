# Resolve the virtual environment inside the script's directory (python/.venv)
$venvPath = Join-Path -Path $PSScriptRoot -ChildPath ".venv\Scripts\Activate.ps1"

Push-Location $PSScriptRoot
try {
    if (Test-Path $venvPath) {
        Write-Host "Activating existing virtual environment..."
    } else {
        Write-Host "Virtual environment not found. Creating a new one..."
        python -m venv .venv
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    Write-Host "Activating virtual environment..."
    & $venvPath

    # Install required packages
    Write-Host "Installing required packages..."
    python -m pip install -q -r requirements.txt
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    # Run the Python script to extract data
    Write-Host "Running the data extraction script..."
    python extract.py @args
    exit $LASTEXITCODE
} finally {
    Pop-Location
}