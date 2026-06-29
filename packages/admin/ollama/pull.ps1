param(
    [string]$model = "ministral-3:8b",
    # This allows users to type -host or --host, but inside the script 
    # we safely use the variable $ollamaHost to avoid clashing with PowerShell's built-in $host
    [Alias('host')]
    [string]$ollamaHost = "localhost:11434",

    # Workaround: Capture unrecognized arguments (like --model)
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$ExtraArgs
)

# Parse any double-hyphen arguments to maintain Linux muscle memory
if ($ExtraArgs -ne $null) {
    for ($i = 0; $i -lt $ExtraArgs.Count; $i++) {
        switch ($ExtraArgs[$i]) {
            '--host'  { $ollamaHost = $ExtraArgs[++$i] }
            '--model' { $model = $ExtraArgs[++$i] }
        }
    }
}

$url = "http://$ollamaHost/api/pull"

# Convert the payload to a JSON string
$body = @{
    name = $model
} | ConvertTo-Json

Write-Host "Pulling model '$model' from Ollama at '$ollamaHost'..."

try {
    # Using native curl.exe to handle the streaming response cleanly.
    # Arguments explained:
    #   -s : Silent mode. Hides curl's default progress meter so it doesn't clash with Ollama's output.
    #   -N : No-buffer. Disables output buffering so we see Ollama's JSON stream in real-time.
    #   -X POST : Specifies the request method.
    #   -H : Sets the Content-Type header.
    #   -d : Sends the JSON body data.
    curl.exe -s -N -X POST $url -H "Content-Type: application/json" -d $body

    # Check the automatic variable $LASTEXITCODE to see if curl encountered an error
    if ($LASTEXITCODE -ne 0) {
        throw "curl.exe exited with error code $LASTEXITCODE"
    }

    Write-Host "`nModel '$model' pulled successfully."
}
catch {
    Write-Error "Failed to pull model '$model'. Error: $($_.Exception.Message)"
    exit 1
}