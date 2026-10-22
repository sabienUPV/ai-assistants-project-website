# Activate the virtual environment from the current directory (at .venv)
$venvPath = Join-Path -Path (Get-Location) -ChildPath ".venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Write-Host "Activating existing virtual environment..."
} else {
    Write-Host "Virtual environment not found. Creating a new one..."
    python -m venv .venv
}

Write-Host "Activating virtual environment..."
& $venvPath

# Install required packages
Write-Host "Installing required packages..."
pip install -r requirements.txt

# Run the Python script to extract data
Write-Host "Running the data extraction script..."
python extract.py