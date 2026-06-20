[CmdletBinding()]
param(
  [string]$SrsHome = $env:SRS_HOME,
  [ValidateSet('live', 'rtc')]
  [string]$Mode = 'live',
  [switch]$Foreground
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$logDir = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Resolve-SrsHome {
  $candidates = @()
  if ($SrsHome) {
    $candidates += $SrsHome
  }

  $candidates += (Join-Path $projectRoot '.local-cache\srs')
  $candidates += 'F:\AIshuziren\siyuAI_V194\siyuAI_V194\assets\srs'

  foreach ($candidate in $candidates) {
    if (-not $candidate) {
      continue
    }

    $fullPath = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path (Join-Path $fullPath 'objs\srs.exe')) {
      return $fullPath
    }
  }

  throw "SRS runtime not found. Set SRS_HOME or place SRS under $projectRoot\.local-cache\srs"
}

function Test-ListenPort {
  param([int]$Port)

  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return [bool]$connection
}

function Wait-ListenPort {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 15
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-ListenPort -Port $Port) {
      return $true
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

$resolvedSrsHome = Resolve-SrsHome
$configPath = if ($Mode -eq 'rtc') { 'conf\rtmp2rtc.conf' } else { 'conf\live.conf' }
$fullConfigPath = Join-Path $resolvedSrsHome $configPath
if (-not (Test-Path $fullConfigPath)) {
  throw "SRS config not found: $fullConfigPath"
}

$requiredTcpPorts = @(1935, 1985, 8080)
$busyPorts = @($requiredTcpPorts | Where-Object { Test-ListenPort -Port $_ })
if ($busyPorts.Count -eq $requiredTcpPorts.Count) {
  Write-Host "SRS seems already running. Ports: $($requiredTcpPorts -join ', ')"
  Write-Host 'OBS server: rtmp://127.0.0.1/live'
  Write-Host 'OBS stream key: dh'
  Write-Host 'Preview: http://127.0.0.1:8080/players/srs_player.html?autostart=true&schema=http&host=127.0.0.1&port=8080&app=live&stream=dh'
  exit 0
}

if ($busyPorts.Count -gt 0) {
  throw "Cannot start SRS because port(s) are already in use: $($busyPorts -join ', ')"
}

$stdoutLog = Join-Path $logDir 'srs.out.log'
$stderrLog = Join-Path $logDir 'srs.err.log'
$srsExe = Join-Path $resolvedSrsHome 'objs\srs.exe'

Write-Host "Starting SRS from: $resolvedSrsHome"
Write-Host "Config: $configPath"

if ($Foreground) {
  Push-Location $resolvedSrsHome
  try {
    & $srsExe -c $configPath
  } finally {
    Pop-Location
  }
  exit $LASTEXITCODE
}

$process = Start-Process `
  -FilePath $srsExe `
  -ArgumentList @('-c', $configPath) `
  -WorkingDirectory $resolvedSrsHome `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -PassThru

foreach ($port in $requiredTcpPorts) {
  if (-not (Wait-ListenPort -Port $port -TimeoutSeconds 15)) {
    throw "SRS process $($process.Id) started, but port $port did not open. Check $stdoutLog and $stderrLog"
  }
}

Write-Host "SRS started. PID: $($process.Id)"
Write-Host 'OBS server: rtmp://127.0.0.1/live'
Write-Host 'OBS stream key: dh'
Write-Host 'Full RTMP: rtmp://127.0.0.1/live/dh'
Write-Host 'Preview: http://127.0.0.1:8080/players/srs_player.html?autostart=true&schema=http&host=127.0.0.1&port=8080&app=live&stream=dh'
Write-Host "Logs: $stdoutLog ; $stderrLog"
