param(
    # Note: PowerShell natively supports single hyphen parameters (-model, -prompt)
    [string]$model = "llama3.2:1b",
    # This allows users to type -host or --host, but inside the script 
    # we safely use the variable $ollamaHost to avoid clashing with PowerShell's built-in $host
    [Alias('host')]
    [string]$ollamaHost = "localhost:11434",
    [string]$prompt = "",
    [string]$system = "",
    
    # Workaround: Capture unrecognized arguments (like --model or --prompt)
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$ExtraArgs
)

# Parse any double-hyphen arguments to maintain Linux muscle memory
if ($null -ne $ExtraArgs) {
    for ($i = 0; $i -lt $ExtraArgs.Count; $i++) {
        switch ($ExtraArgs[$i]) {
            '--host'   { $ollamaHost = $ExtraArgs[++$i] }
            '--model'  { $model = $ExtraArgs[++$i] }
            '--prompt' { $prompt = $ExtraArgs[++$i] }
            '--system' { $system = $ExtraArgs[++$i] }
        }
    }
}

# Validation: Ensure a prompt was provided
if ([string]::IsNullOrWhiteSpace($prompt)) {
    Write-Error "A prompt is required. Please provide it using -prompt or --prompt."
    exit 1
}

$url = "http://$ollamaHost/api/generate"

# Dynamically build the request object
# Note: We default to stream=false for simplicity, but you can modify this if you want streaming output.
$bodyObj = @{
    model = $model
    prompt = $prompt
    stream = $false
}

# Only add the system prompt to the JSON if it was provided
if (-not [string]::IsNullOrWhiteSpace($system)) {
    $bodyObj.system = $system
}

# Convert the object to a clean JSON string
$body = $bodyObj | ConvertTo-Json

Write-Host "Generating text with model '$model' from Ollama at '$ollamaHost'..."

try {
    # Using native curl.exe for clean, real-time streaming
    curl.exe -s -N -X POST $url -H "Content-Type: application/json" -d $body

    if ($LASTEXITCODE -ne 0) {
        throw "curl.exe exited with error code $LASTEXITCODE"
    }

    Write-Host "`n`nText generated successfully with model '$model'."
}
catch {
    Write-Error "Failed to generate text. Error: $($_.Exception.Message)"
    exit 1
}