$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$iconsDirectory = Join-Path $repositoryRoot "icons"
New-Item -ItemType Directory -Path $iconsDirectory -Force | Out-Null

foreach ($size in @(16, 32, 48, 128)) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $margin = [Math]::Max(1, [Math]::Round($size * 0.055))
    $radius = [Math]::Max(3, [Math]::Round($size * 0.23))
    $rect = [System.Drawing.RectangleF]::new(
        [single]$margin,
        [single]$margin,
        [single]($size - (2 * $margin)),
        [single]($size - (2 * $margin))
    )
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()

    $green = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 0, 168, 132))
    $graphics.FillPath($green, $path)

    $whitePen = [System.Drawing.Pen]::new(
        [System.Drawing.Color]::White,
        [single][Math]::Max(1.2, $size * 0.075)
    )
    $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $centerY = $size * 0.5
    $positions = @(0.28, 0.39, 0.50, 0.61, 0.72)
    $heights = @(0.18, 0.34, 0.48, 0.30, 0.14)

    for ($index = 0; $index -lt $positions.Count; $index++) {
        $x = $size * $positions[$index]
        $halfHeight = $size * $heights[$index] * 0.5
        $graphics.DrawLine($whitePen, $x, $centerY - $halfHeight, $x, $centerY + $halfHeight)
    }

    $target = Join-Path $iconsDirectory "icon-$size.png"
    $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)

    $whitePen.Dispose()
    $green.Dispose()
    $path.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

Write-Output "Ícones gerados em $iconsDirectory"
