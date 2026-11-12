param([string]$ServerIP = '192.168.1.4', [switch]$ConfigureFirewall)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerExe = if ($dockerCommand) { $dockerCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe' }
if (-not (Test-Path -LiteralPath $dockerExe)) { throw 'Docker Desktop is not installed.' }
$address = $null
if ($ServerIP -ne 'localhost' -and -not [Net.IPAddress]::TryParse($ServerIP, [ref]$address)) { throw 'ServerIP must be localhost or a valid IP address.' }
if ($ConfigureFirewall) { & (Join-Path $PSScriptRoot 'setup-lan.ps1') }
$envFile = Join-Path $PSScriptRoot '.env.docker'
$existing = if (Test-Path -LiteralPath $envFile) { [IO.File]::ReadAllLines($envFile) } else { @() }
$settings = @($existing | Where-Object { $_ -notmatch '^TEAMUP_APP_URL=' })
$settings += "TEAMUP_APP_URL=http://${ServerIP}:3001"
[IO.File]::WriteAllLines($envFile, $settings, (New-Object Text.UTF8Encoding $false))
& $dockerExe info --format 'Docker Engine {{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Cannot access Docker Engine. Open Docker Desktop, wait for Engine running, then run this script in your own PowerShell.' }
& $dockerExe compose --env-file .env.docker -p teamup config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Invalid Compose configuration.' }
& $dockerExe compose --env-file .env.docker -p teamup up --build -d --wait --wait-timeout 120
if ($LASTEXITCODE -ne 0) {
  & $dockerExe compose --env-file .env.docker -p teamup logs --tail 80 teamup
  throw 'Docker build/start failed. See the log above.'
}
& $dockerExe compose --env-file .env.docker -p teamup exec -T teamup node scripts/check-docker.js
if ($LASTEXITCODE -ne 0) { throw 'Container smoke test failed.' }
$health = Invoke-RestMethod -Uri 'http://localhost:3001/api/health' -TimeoutSec 10
if (-not $health.ok -or $health.database -ne 'sqlite') { throw 'Host API/database health check failed.' }
New-Item -ItemType Directory -Force -Path work | Out-Null
@{ healthy = $true; local = 'http://localhost:3001'; lan = "http://${ServerIP}:3001"; database = $health.database; checkedAt = (Get-Date).ToString('o') } |
  ConvertTo-Json | Set-Content -Encoding utf8 work/docker-start-status.json
Write-Host "Local: http://localhost:3001"
Write-Host "Other computers on this Wi-Fi: http://${ServerIP}:3001"
Write-Host 'Logs: docker compose --env-file .env.docker -p teamup logs -f teamup'
