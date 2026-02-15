<#
Create a release ZIP of the project folder (excludes .git and the ZIP itself).
Usage: Open PowerShell in this folder and run: .\create-zip.ps1
#>
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$zip = Join-Path $root 'miniatc-release.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }

$items = Get-ChildItem -Path $root -Force | Where-Object { $_.Name -ne '.git' -and $_.Name -ne 'miniatc-release.zip' }
$paths = $items | ForEach-Object { $_.FullName }
Compress-Archive -Path $paths -DestinationPath $zip -Force

Write-Host "Created $zip"
