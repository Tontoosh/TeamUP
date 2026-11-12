param(
  [string]$BaseBranch = 'main',
  [string]$PublishBranch = 'labs-6-8-9-10',
  [string]$GitExe
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not $GitExe) {
  $command = Get-Command git -ErrorAction SilentlyContinue
  $GitExe = if ($command) { $command.Source } else { 'C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1111-570-0_26.1111.570.0_x64__3k8sg7r9htsxt\dependencies\native\git\cmd\git.exe' }
}
if (-not (Test-Path -LiteralPath $GitExe)) { throw 'Git is missing. Install Git for Windows, reopen PowerShell, then retry.' }
function Invoke-Git {
  $result = & $GitExe @args
  if ($LASTEXITCODE -ne 0) { throw "Git failed: $($args[0]). Check the message above." }
  return $result
}
$remote = Invoke-Git remote get-url origin
if ($remote -notmatch '^https://github\.com/Tontoosh/TeamUP(?:\.git)?/?$') { throw 'Unexpected origin URL. Inspect git remote -v before publishing.' }
$changes = Invoke-Git status --porcelain
if ($changes) { throw 'Workspace has uncommitted changes. Review and commit them before publishing.' }
Invoke-Git check-ref-format --branch $PublishBranch | Out-Null
Write-Host 'Fetching GitHub history. Complete the GitHub browser sign-in if prompted.'
Invoke-Git fetch origin
$base = [string](Invoke-Git rev-parse --verify "refs/remotes/origin/$BaseBranch")
$source = [string](Invoke-Git rev-parse HEAD)
$sourceTree = [string](Invoke-Git rev-parse "$source^{tree}")
$parent = $base
$parentTree = [string](Invoke-Git rev-parse "$base^{tree}")
# The supplied project was a ZIP without Git history. Re-parent its snapshots onto
# GitHub's current base in a NEW branch; never replace or force-push the base ref.
$commits = @(Invoke-Git rev-list --reverse $source)
foreach ($commit in $commits) {
  $tree = [string](Invoke-Git rev-parse "$commit^{tree}")
  if ($tree -eq $parentTree) { continue }
  $message = @(Invoke-Git show -s --format=%B $commit) -join "`n"
  $parent = [string](Invoke-Git commit-tree $tree -p $parent -m $message)
  $parentTree = $tree
}
if ($parentTree -ne $sourceTree) { throw 'Published snapshot does not match the source workspace.' }
# Use a fresh branch if this name already exists locally or on GitHub.
$refs = @(Invoke-Git for-each-ref --format='%(refname)' "refs/heads/$PublishBranch" "refs/remotes/origin/$PublishBranch")
if ($refs.Count -gt 0) { $PublishBranch = "$PublishBranch-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }
Invoke-Git update-ref "refs/heads/$PublishBranch" $parent ('0' * 40)
Write-Host "Publishing branch: $PublishBranch"
Invoke-Git push --set-upstream origin $PublishBranch
$remoteHead = @(Invoke-Git ls-remote --heads origin "refs/heads/$PublishBranch")
if (-not ($remoteHead | Where-Object { $_ -match "^$parent\s" })) { throw 'Remote commit verification failed.' }
New-Item -ItemType Directory -Force -Path work | Out-Null
$compare = "https://github.com/Tontoosh/TeamUP/compare/${BaseBranch}...${PublishBranch}?expand=1"
@{ repository = 'https://github.com/Tontoosh/TeamUP'; branch = $PublishBranch; head = $parent; base = $base; source = $source; verified = $true; compare = $compare } |
  ConvertTo-Json | Set-Content -Encoding utf8 work/github-publish-status.json
Write-Host "SUCCESS: all lab commits published to $PublishBranch"
Write-Host "Create the lab6 Pull Request here: $compare"
Write-Host 'The base branch has not been changed. Review the complete diff before merging.'
