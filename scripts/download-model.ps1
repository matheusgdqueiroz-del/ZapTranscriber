$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$modelDirectory = Join-Path $repositoryRoot "models\onnx-community\whisper-tiny"
$revision = "ff4177021cc41f7db950912b73ea4fdf7d01d8e7"
$baseUrl = "https://huggingface.co/onnx-community/whisper-tiny/resolve/$revision"

$files = @(
    "added_tokens.json",
    "config.json",
    "generation_config.json",
    "merges.txt",
    "normalizer.json",
    "preprocessor_config.json",
    "quantize_config.json",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
    "onnx/encoder_model_quantized.onnx",
    "onnx/decoder_model_merged_quantized.onnx"
)

$expectedHashes = @{
    "onnx/encoder_model_quantized.onnx" = "2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19"
    "onnx/decoder_model_merged_quantized.onnx" = "25e807a962b6349356d0ea5d0dfe530b7e5bf0e2a484aeca0359d03143faddd3"
}

foreach ($relativeFile in $files) {
    $target = Join-Path $modelDirectory $relativeFile
    $targetDirectory = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null

    if (-not (Test-Path -LiteralPath $target)) {
        $urlPath = $relativeFile.Replace("\", "/")
        Write-Output "Baixando $relativeFile"
        Invoke-WebRequest -Uri "$baseUrl/$urlPath" -OutFile $target
    }

    if ($expectedHashes.ContainsKey($relativeFile)) {
        $actualHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $expectedHashes[$relativeFile]) {
            throw "Hash inválido para $relativeFile"
        }
    }
}

Write-Output "Modelo local disponível em $modelDirectory"
