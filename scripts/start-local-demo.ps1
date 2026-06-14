param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$DigitalHumanAdapter = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
  Write-Host "[$stamp] $Message"
}

function Test-Port {
  param(
    [string]$HostName,
    [int]$Port
  )

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync($HostName, $Port)
    if (-not $task.Wait(500)) {
      return $false
    }

    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Wait-Port {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port -HostName $HostName -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }

  return $false
}

function Start-ManagedProcess {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$OutLog,
    [string]$ErrLog
  )

  New-Item -ItemType Directory -Path (Split-Path $OutLog -Parent) -Force | Out-Null
  Write-Step "Starting $Name"
  return Start-Process -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -PassThru
}

Set-Location $ProjectRoot
$adapterName = if ($DigitalHumanAdapter) {
  $DigitalHumanAdapter
} elseif ($env:DH_ADAPTER) {
  $env:DH_ADAPTER
} else {
  'print'
}

Write-Step "Repairing local demo binding and stale commands"
node scripts/local-demo.mjs repair

$serverLog = 'C:\tmp\szr-server.out.log'
$serverErr = 'C:\tmp\szr-server.err.log'
$viteLog = 'C:\tmp\szr-vite.out.log'
$viteErr = 'C:\tmp\szr-vite.err.log'
$executorLog = 'C:\tmp\szr-executor.out.log'
$executorErr = 'C:\tmp\szr-executor.err.log'

if (Test-Port -HostName '127.0.0.1' -Port 3000) {
  Write-Step 'Backend already listens on http://localhost:3000'
} else {
  Start-ManagedProcess -Name 'backend API' `
    -WorkingDirectory $ProjectRoot `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'server:start') `
    -OutLog $serverLog `
    -ErrLog $serverErr | Out-Null

  if (-not (Wait-Port -HostName '127.0.0.1' -Port 3000 -TimeoutSeconds 25)) {
    throw "Backend did not open port 3000. Check $serverLog and $serverErr"
  }
}

if (Test-Port -HostName '127.0.0.1' -Port 5173) {
  Write-Step 'Frontend already listens on http://localhost:5173'
} else {
  Start-ManagedProcess -Name 'Vite frontend' `
    -WorkingDirectory $ProjectRoot `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1') `
    -OutLog $viteLog `
    -ErrLog $viteErr | Out-Null

  if (-not (Wait-Port -HostName '127.0.0.1' -Port 5173 -TimeoutSeconds 25)) {
    throw "Frontend did not open port 5173. Check $viteLog and $viteErr"
  }
}

$healthBefore = node scripts/local-demo.mjs health --json | ConvertFrom-Json
$heartbeat = $healthBefore.checks | Where-Object { $_.name -eq 'executor.heartbeat' } | Select-Object -First 1

if ($heartbeat.status -eq 'ok') {
  Write-Step 'Local executor heartbeat is fresh'
} else {
  Write-Step "Starting local executor client with DH_ADAPTER=$adapterName"
  $env:EXECUTOR_BASE_URL = 'http://localhost:3000'
  $env:DH_ADAPTER = $adapterName
  Start-ManagedProcess -Name 'local executor client' `
    -WorkingDirectory (Join-Path $ProjectRoot 'executor-client') `
    -FilePath 'npm.cmd' `
    -ArgumentList @('start') `
    -OutLog $executorLog `
    -ErrLog $executorErr | Out-Null
  Start-Sleep -Seconds 4
}

Write-Step 'Running final health check'
node scripts/local-demo.mjs health

Write-Host ''
Write-Host 'Local demo is ready:'
Write-Host '  Login:   http://localhost:5173/login'
Write-Host '  Control: http://localhost:5173/live/control-room'
Write-Host '  User:    admin'
Write-Host "  Adapter: $adapterName"
Write-Host '  Password: use the current local demo password'
Write-Host ''
Write-Host 'Logs:'
Write-Host "  Backend:  $serverLog"
Write-Host "  Frontend: $viteLog"
Write-Host "  Executor: $executorLog"
