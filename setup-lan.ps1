$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Open PowerShell as Administrator and run start-docker.ps1 -ConfigureFirewall.' }
$ruleName = 'TeamUP-LAN-TCP-3001'
$existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  $port = $existing | Get-NetFirewallPortFilter
  $scope = $existing | Get-NetFirewallAddressFilter
  if ($existing.Direction -ne 'Inbound' -or $existing.Action -ne 'Allow' -or
      $existing.Profile.ToString() -ne 'Private' -or $port.LocalPort -ne '3001' -or
      $port.Protocol -ne 'TCP' -or $scope.RemoteAddress -notcontains 'LocalSubnet') { throw "Existing $ruleName has different settings. Inspect it first." }
  Enable-NetFirewallRule -Name $ruleName | Out-Null
} else {
  New-NetFirewallRule -Name $ruleName -DisplayName 'TeamUP LAN TCP 3001' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 -Profile Private -RemoteAddress LocalSubnet | Out-Null
}
Write-Host 'TeamUP TCP 3001 is allowed from the local subnet on Private networks.'
if (-not (Get-NetConnectionProfile | Where-Object NetworkCategory -eq 'Private')) { Write-Warning 'No Private network is active. Review your trusted Wi-Fi profile before connecting other computers.' }
