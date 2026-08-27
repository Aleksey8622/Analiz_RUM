$ErrorActionPreference = 'Stop'

$desktopProject = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Analysis Room\Analysis Room'
$currentProject = (Get-Location).Path
$project = if (Test-Path -LiteralPath (Join-Path $currentProject 'package.json')) { $currentProject } else { $desktopProject }

if (-not (Test-Path -LiteralPath (Join-Path $project 'package.json'))) {
  throw "Не найдена папка проекта: $project"
}

$npm = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'Programs\nodejs') -Filter npm.cmd -File -Recurse -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $npm) {
  throw 'Не найден npm.cmd'
}

$temp = Join-Path $env:TEMP 'AnalizRUMUpdate'
$zip = Join-Path $env:TEMP 'AnalizRUMUpdate.zip'

Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue

Invoke-WebRequest -Uri 'https://codeload.github.com/Aleksey8622/Analiz_RUM/zip/refs/heads/develop' -OutFile $zip
Expand-Archive -LiteralPath $zip -DestinationPath $temp -Force
$source = Get-ChildItem -LiteralPath $temp -Directory | Select-Object -First 1 -ExpandProperty FullName

robocopy $source $project /E /XD '.git' 'node_modules' | Out-Host
if ($LASTEXITCODE -gt 7) {
  throw "Ошибка копирования файлов: $LASTEXITCODE"
}

Push-Location $project
try {
  & $npm run build
  if ($LASTEXITCODE -ne 0) {
    throw 'Ошибка сборки приложения'
  }

  $electron = Join-Path $project 'node_modules\electron\dist\electron.exe'
  if (-not (Test-Path -LiteralPath $electron)) {
    throw 'Не найден electron.exe в папке проекта'
  }

  Start-Process -FilePath $electron -ArgumentList '.' -WorkingDirectory $project
  Write-Host 'Analysis Room обновлён и запущен.' -ForegroundColor Green
}
finally {
  Pop-Location
}
