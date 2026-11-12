$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$node = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (!(Test-Path $node)) { throw 'Install Node.js 22.13 or newer, then run this launcher again.' }
if (!(Test-Path 'node_modules\vite\bin\vite.js')) { throw 'Dependencies are missing. Run npm install in this folder first.' }
if (!(Test-Path '.env')) { Copy-Item '.env.example' '.env' }
& $node node_modules/typescript/bin/tsc -b
if ($LASTEXITCODE -ne 0) { throw 'TypeScript build failed.' }
& $node node_modules/vite/bin/vite.js build
if ($LASTEXITCODE -ne 0) { throw 'Vite build failed.' }

& $node scripts/check-db.js
if ($LASTEXITCODE -ne 0) { throw 'Database connection failed. Read the diagnostic above; run this launcher as the Windows user used in SSMS.' }
& $node scripts/verify-db-api.js
if ($LASTEXITCODE -ne 0) { throw 'Database/API verification failed. See work/db-api-verification.json.' }
Write-Host 'Open http://localhost:3001 in your browser. Press Ctrl+C to stop.'
& $node server/index.js



