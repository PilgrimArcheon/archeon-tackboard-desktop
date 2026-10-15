$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
cmd /c 'npm ci'
if ($LASTEXITCODE -ne 0) { throw 'Desktop dependency installation failed.' }
cmd /c 'npm test'
if ($LASTEXITCODE -ne 0) { throw 'Desktop tests failed.' }
Write-Host 'TackBoard Desktop source checks passed. Native installer tests are separate.' -ForegroundColor Green
