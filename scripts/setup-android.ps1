$ErrorActionPreference = 'Stop'
$taskProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskSdkRoot = Join-Path $taskProjectRoot '.android-sdk'
$taskArchive = Join-Path $taskSdkRoot 'platform-tools.zip'
New-Item -ItemType Directory -Path $taskSdkRoot -Force | Out-Null
try {
  Write-Output 'Downloading official Android Platform-Tools...'
  Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' -OutFile $taskArchive -UseBasicParsing
  Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskSdkRoot -Force
  $taskAdb = Join-Path $taskSdkRoot 'platform-tools\adb.exe'
  if (-not (Test-Path -LiteralPath $taskAdb)) { throw 'The download did not contain adb.exe.' }
  & $taskAdb version
  if ($LASTEXITCODE -ne 0) { throw 'Android Platform-Tools could not run.' }
  Write-Output 'Android Platform-Tools ready. Restart Expo using npm run start:mobile.'
} finally {
  if (Test-Path -LiteralPath $taskArchive) { Remove-Item -LiteralPath $taskArchive -Force }
}
