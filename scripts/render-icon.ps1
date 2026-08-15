Add-Type -AssemblyName System.Drawing

$size = 512
$bitmap = [System.Drawing.Bitmap]::new($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-RoundedPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$frame = New-RoundedPath 12 12 488 488 112
$background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  [System.Drawing.Point]::new(48, 28),
  [System.Drawing.Point]::new(464, 484),
  [System.Drawing.ColorTranslator]::FromHtml('#172536'),
  [System.Drawing.ColorTranslator]::FromHtml('#070A0F')
)
$graphics.FillPath($background, $frame)
$border = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#2B4158'), 14)
$graphics.DrawPath($border, $frame)

$shieldPoints = [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(256, 82),
  [System.Drawing.PointF]::new(397, 142),
  [System.Drawing.PointF]::new(397, 252),
  [System.Drawing.PointF]::new(369, 338),
  [System.Drawing.PointF]::new(306, 401),
  [System.Drawing.PointF]::new(256, 430),
  [System.Drawing.PointF]::new(206, 401),
  [System.Drawing.PointF]::new(143, 338),
  [System.Drawing.PointF]::new(115, 252),
  [System.Drawing.PointF]::new(115, 142)
)
$shieldFill = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(52, 35, 175, 238))
$shieldPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#29BFF1'), 17)
$graphics.FillPolygon($shieldFill, $shieldPoints)
$graphics.DrawPolygon($shieldPen, $shieldPoints)

$blade = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#ECFBFF'), 29)
$blade.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$blade.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($blade, 166, 174, 346, 354)
$graphics.DrawLine($blade, 346, 174, 166, 354)

$handle = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#3BD4FA'), 21)
$handle.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$handle.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($handle, 157, 345, 195, 383)
$graphics.DrawLine($handle, 355, 345, 317, 383)

$core = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#0C1723'))
$coreBorder = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#7DEBFF'), 10)
$graphics.FillEllipse($core, 224, 224, 64, 64)
$graphics.DrawEllipse($coreBorder, 224, 224, 64, 64)

$target = Join-Path $PSScriptRoot '..\build\icon.png'
$bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)

$coreBorder.Dispose()
$core.Dispose()
$handle.Dispose()
$blade.Dispose()
$shieldPen.Dispose()
$shieldFill.Dispose()
$border.Dispose()
$background.Dispose()
$frame.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
