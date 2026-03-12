$ErrorActionPreference = "Stop"

$logDir = "logs"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = "$logDir\verify_frontend_boot_$timestamp.log"

function Write-Log {
    param([string]$message, [switch]$isError)
    $text = "[$(Get-Date -Format 'HH:mm:ss')] $message"
    Add-Content -Path $logFile -Value $text
    if ($isError) { Write-Host $text -ForegroundColor Red }
    else { Write-Host $text }
}

Write-Log "Starting frontend boot smoke verification..."

try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Log "Node.js is not available on PATH. Frontend smoke test cannot run." -isError
        exit 1
    }

    $scriptPath = Join-Path (Get-Location) "scripts\verify_frontend_boot.mjs"
    if (!(Test-Path $scriptPath)) {
        Write-Log "verify_frontend_boot.mjs not found at $scriptPath" -isError
        exit 1
    }

    Write-Log "Running Node frontend verifier..."
    $nodeOutput = & node $scriptPath 2>&1
    $nodeOutput | ForEach-Object { Write-Log $_ }

    if ($LASTEXITCODE -ne 0) {
        Write-Log "Frontend boot verification FAILED." -isError
        exit 1
    }

    Write-Log "Frontend boot verification PASS."
    exit 0
}
catch {
    Write-Log "Exception during frontend boot verification: $($_.Exception.Message)" -isError
    exit 1
}

