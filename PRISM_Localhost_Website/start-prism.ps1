$ErrorActionPreference = "Stop"
Write-Host "PRISM localhost launcher" -ForegroundColor Cyan

$root = $PSScriptRoot
$front = Join-Path $root "frontend"
$back = Join-Path $root "backend"

if (-not (Test-Path (Join-Path $front ".env"))) {
  Copy-Item (Join-Path $front ".env.example") (Join-Path $front ".env")
}
if (-not (Test-Path (Join-Path $back ".env"))) {
  Copy-Item (Join-Path $back ".env.example") (Join-Path $back ".env")
}

$venvPython = Join-Path $back ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
  Write-Host "Creating Python environment and installing SARASH backend packages..." -ForegroundColor Yellow
  Push-Location $back
  python -m venv .venv
  & $venvPython -m pip install --upgrade pip
  & $venvPython -m pip install -r requirements.txt
  Pop-Location
}

if (-not (Test-Path (Join-Path $front "node_modules"))) {
  Write-Host "Installing frontend packages..." -ForegroundColor Yellow
  Push-Location $front
  npm install
  Pop-Location
}

Write-Host "Starting SARASH backend on http://localhost:8000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$back'; & '.\.venv\Scripts\python.exe' -m uvicorn app:app --reload --port 8000"

Write-Host "Starting PRISM frontend on http://localhost:5173" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$front'; npm run dev"

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
