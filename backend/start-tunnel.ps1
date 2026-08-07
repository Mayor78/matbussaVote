param(
    [int]$Port = 3001,
    [string]$Domain = "unlovable-neumatic-ozella.ngrok-free.dev"
)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$distDir = Join-Path $rootDir "dist"
$publicUrl = "https://$Domain"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Voting Platform - Self-Hosted" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Build frontend if needed ──
if (-not (Test-Path (Join-Path $distDir "index.html"))) {
    Write-Host "[0/2] Building frontend..." -ForegroundColor Yellow
    Push-Location $rootDir
    try {
        npx vite build 2>&1 | ForEach-Object { if ($_ -match "error|Error") { Write-Host $_ -ForegroundColor Red } }
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }
        Write-Host "       Build complete." -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[0/2] Frontend build found. To rebuild, delete the dist folder." -ForegroundColor Gray
}

# ── Start Express server (serves frontend + API) ──
Write-Host "[1/2] Starting server on port $Port..." -ForegroundColor Yellow
$env:NODE_ENV = "production"
$serverJob = Start-Job -Name "voting-server" -ScriptBlock {
    param($dir, $port)
    $env:PORT = $port
    Set-Location $dir
    node src/index.js 2>&1
} -ArgumentList (Join-Path $rootDir "backend"), $Port

Start-Sleep -Seconds 3

$healthUrl = "http://localhost:$Port/api/health"
try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
    Write-Host "       Server OK." -ForegroundColor Green
} catch {
    Write-Host "       FAILED - could not reach $healthUrl" -ForegroundColor Red
    Receive-Job -Name "voting-server" | Write-Host
    Stop-Job -Name "voting-server"
    Remove-Job -Name "voting-server"
    exit 1
}

# ── Find ngrok ──
$ngrokPath = (Get-Command ngrok -ErrorAction SilentlyContinue).Source
if (-not $ngrokPath) {
    $ngrokPath = (Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "ngrok.exe" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ngrokPath) {
    Write-Host "ngrok not found. Run: winget install Ngrok.Ngrok" -ForegroundColor Red
    Stop-Job -Name "voting-server"
    Remove-Job -Name "voting-server"
    exit 1
}

Write-Host "[2/2] Starting ngrok tunnel..." -ForegroundColor Yellow
Write-Host ""

$tunnelProc = Start-Process -FilePath $ngrokPath `
    -ArgumentList "http", "--url=$Domain", "$Port" `
    -NoNewWindow `
    -PassThru

Start-Sleep -Seconds 2

if ($tunnelProc.HasExited) {
    Write-Host "       ngrok failed to start. Check your authtoken and domain." -ForegroundColor Red
    Stop-Job -Name "voting-server"
    Remove-Job -Name "voting-server"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  LIVE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Public URL:  $publicUrl" -ForegroundColor Cyan
Write-Host "  API:         $publicUrl/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Vercel env var (set once):" -ForegroundColor White
Write-Host "  VITE_API_URL = $publicUrl/api" -ForegroundColor Yellow
Write-Host ""
$publicUrl | Set-Clipboard
Write-Host "  (URL copied to clipboard)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Voters use the Vercel link. This URL stays the same forever." -ForegroundColor White
Write-Host "  Press Ctrl+C to stop everything." -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# ── Wait ──
try {
    while ($true) {
        Start-Sleep -Seconds 5
        if ($tunnelProc.HasExited) {
            Write-Host "ngrok stopped unexpectedly. Check your authtoken." -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host "Shutting down..." -ForegroundColor Yellow
    if ($tunnelProc -and !$tunnelProc.HasExited) { $tunnelProc.Kill() }
    Stop-Job -Name "voting-server" -ErrorAction SilentlyContinue
    Remove-Job -Name "voting-server" -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
