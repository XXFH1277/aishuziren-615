[CmdletBinding()]
param(
  [string]$SrsHome = $env:SRS_HOME,
  [switch]$All
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

function Get-CandidateRoots {
  $roots = @()
  if ($SrsHome) {
    $roots += $SrsHome
  }

  $roots += (Join-Path $projectRoot '.local-cache\srs')
  $roots += 'F:\AIshuziren\siyuAI_V194\siyuAI_V194\assets\srs'

  return $roots |
    Where-Object { $_ } |
    ForEach-Object { [System.IO.Path]::GetFullPath($_).TrimEnd('\').ToLowerInvariant() }
}

$candidateRoots = @(Get-CandidateRoots)
$processes = @(Get-Process -Name 'srs' -ErrorAction SilentlyContinue)

if ($processes.Count -eq 0) {
  Write-Host 'No srs.exe process is running.'
  exit 0
}

$targets = @()
foreach ($process in $processes) {
  $path = ''
  try {
    $path = $process.Path
  } catch {
    $path = ''
  }

  $normalizedPath = if ($path) { [System.IO.Path]::GetFullPath($path).ToLowerInvariant() } else { '' }
  $matchesKnownRoot = $false
  foreach ($root in $candidateRoots) {
    if ($normalizedPath.StartsWith($root)) {
      $matchesKnownRoot = $true
      break
    }
  }

  if ($All -or $matchesKnownRoot) {
    $targets += $process
  }
}

if ($targets.Count -eq 0) {
  Write-Host 'Found srs.exe, but it does not match this project or known SRS_HOME. Use -All to stop every srs.exe process.'
  exit 0
}

foreach ($target in $targets) {
  Write-Host "Stopping SRS PID: $($target.Id)"
  Stop-Process -Id $target.Id -Force
}

Write-Host 'SRS stopped.'
