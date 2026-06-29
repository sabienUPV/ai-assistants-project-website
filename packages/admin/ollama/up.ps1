param(
    [switch]$gpu,
    [switch]$ui
)

$composeArgs = @('-f', 'compose.yaml')
if ($gpu) {
    $composeArgs += @('-f', 'compose.gpu.yaml')
}
if ($ui) {
    $composeArgs += @('-f', 'compose.ui.yaml')
}

$composeArgs += @('up', '-d', '--build')

Write-Host "Executing: docker compose $($composeArgs -join ' ')"
docker compose $composeArgs