$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$modelDirectory = Join-Path $repositoryRoot "models\onnx-community\whisper-base"
$revision = "0dc963c325ab2554e6dcedbb458decbffb4dc5b1"
$baseUrl = "https://huggingface.co/onnx-community/whisper-base/resolve/$revision"

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
    "onnx/encoder_model_quantized.onnx" = "5862993336bf33acd23736071aae2b32261d3b1b2f37780194460d4ef974dd46"
    "onnx/decoder_model_merged_quantized.onnx" = "fa3ef9902734ce5ae6f9ef2bdb2ba9a6c4b5785b09f4f420ce036573dc9d090b"
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
