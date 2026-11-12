param([string]$ServerIP = 'localhost')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop суулгаж асаасны дараа дахин ажиллуулна уу. DOCKER.md зааврыг үзнэ үү.'
}
$env:TEAMUP_APP_URL = "http://${ServerIP}:3001"
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Docker build/start амжилтгүй. docker compose logs командаар шалгана уу.' }
Write-Host "TeamUP: $env:TEAMUP_APP_URL"
Write-Host 'Төлөв: docker compose ps; лог: docker compose logs -f teamup'
