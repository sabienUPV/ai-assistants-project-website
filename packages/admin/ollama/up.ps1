param(
    # Note: PowerShell only supports single hyphen parameters (in this case: -local, -gpu and -ui)
    [switch]$local,
    [switch]$gpu,
    [switch]$ui,
    
    # Workaround: Capture any unrecognized arguments (like --local, --gpu or --ui)
    # so that we can still detect them (useful for users who are used to double hyphen parameters, like in Linux shells)
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$ExtraArgs
)

# If the user used double hyphens, activate the variables
if ($ExtraArgs -contains '--local') { $local = $true }
if ($ExtraArgs -contains '--gpu') { $gpu = $true }
if ($ExtraArgs -contains '--ui') { $ui = $true }

$composeArgs = @('-f', 'compose.yaml')
if ($local) {
    $composeArgs += @('-f', 'compose.local.yaml')
}
if ($gpu) {
    $composeArgs += @('-f', 'compose.gpu.yaml')
}
if ($ui) {
    $composeArgs += @('-f', 'compose.ui.yaml')
}

$composeArgs += @('up', '-d', '--build')

Write-Host "Executing: docker compose $($composeArgs -join ' ')"
docker compose $composeArgs