$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repositoryRoot "manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$distDirectory = Join-Path $repositoryRoot "dist"
$stagingDirectory = Join-Path $distDirectory "ZapTranscriber"
$archivePath = Join-Path $distDirectory "ZapTranscriber-v$($manifest.version).zip"

Push-Location $repositoryRoot
try {
    npm run build
}
finally {
    Pop-Location
}

if (Test-Path -LiteralPath $stagingDirectory) {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
}

if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null

$packageEntries = @(
    "manifest.json",
    "THIRD_PARTY_LICENSES.txt",
    "background",
    "content",
    "icons",
    "lib",
    "offscreen",
    "popup"
)

foreach ($entry in $packageEntries) {
    $source = Join-Path $repositoryRoot $entry
    Copy-Item -LiteralPath $source -Destination $stagingDirectory -Recurse -Force
}

$modelSource = Join-Path $repositoryRoot "models\onnx-community\whisper-tiny"
$modelDestination = Join-Path $stagingDirectory "models\onnx-community\whisper-tiny"
$modelOnnxDestination = Join-Path $modelDestination "onnx"
New-Item -ItemType Directory -Path $modelOnnxDestination -Force | Out-Null
Get-ChildItem -LiteralPath $modelSource -File |
    Copy-Item -Destination $modelDestination -Force
Copy-Item -LiteralPath (Join-Path $modelSource "onnx\encoder_model_quantized.onnx") -Destination $modelOnnxDestination -Force
Copy-Item -LiteralPath (Join-Path $modelSource "onnx\decoder_model_merged_quantized.onnx") -Destination $modelOnnxDestination -Force

$vendorDestination = Join-Path $stagingDirectory "vendor"
New-Item -ItemType Directory -Path $vendorDestination -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repositoryRoot "vendor\ort-wasm-simd-threaded.mjs") -Destination $vendorDestination -Force
Copy-Item -LiteralPath (Join-Path $repositoryRoot "vendor\ort-wasm-simd-threaded.wasm") -Destination $vendorDestination -Force

Compress-Archive -Path (Join-Path $stagingDirectory "*") -DestinationPath $archivePath
Remove-Item -LiteralPath $stagingDirectory -Recurse -Force

Write-Output $archivePath
