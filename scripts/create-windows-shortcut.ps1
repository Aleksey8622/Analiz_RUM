$ErrorActionPreference = 'Stop'

$project = Split-Path -Parent $PSScriptRoot
$electron = Join-Path $project 'node_modules\electron\dist\electron.exe'
$icon = Join-Path $project 'assets\delekto-kitchen-icon.ico'

if (-not (Test-Path -LiteralPath $electron)) {
  throw "Electron не найден: $electron"
}

if (-not (Test-Path -LiteralPath $icon)) {
  throw "Значок DELEKTO не найден: $icon"
}

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'DELEKTO Analysis Room.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electron
$shortcut.Arguments = '.'
$shortcut.WorkingDirectory = $project
$shortcut.IconLocation = "$icon,0"
$shortcut.Description = 'DELEKTO Analysis Room'
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Host "Ярлык создан: $shortcutPath"
