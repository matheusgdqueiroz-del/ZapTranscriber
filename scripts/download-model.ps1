$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$modelDirectory = Join-Path $repositoryRoot "models\onnx-community\whisper-small"
$revision = "36050c46d777d46dc4b5f43f6d90574fc38f8732"
$baseUrl = "https://huggingface.co/onnx-community/whisper-small/resolve/$revision"

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
    "onnx/encoder_model_quantized.onnx" = "a43a83f3c5361cd591cfa7c36f14b43cf7cb22f47a415cc14a8d557be800fa92"
    "onnx/decoder_model_merged_quantized.onnx" = "ec07c3cbb64172c39791e26ee870a65ac22b458c36722bfe2776b3dbf741e0c9"
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
