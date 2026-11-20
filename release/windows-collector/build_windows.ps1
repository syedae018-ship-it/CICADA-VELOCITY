# ==============================================================================
# Velocity Cicada Local Collector - Windows Build and Packaging Pipeline
# ==============================================================================
# Builds standalone Windows service binaries and Inno Setup installer package.
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "   Velocity Cicada Collector - Windows Build & Packaging Pipeline" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

# 1. Determine Working Python Executable
$PythonExe = "python"
if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $cand = (Get-Command "python").Source
    if ($cand -notlike "*WindowsApps*") {
        $PythonExe = $cand
    }
} elseif (Test-Path "C:\Python312\python.exe") {
    $PythonExe = "C:\Python312\python.exe"
}

Write-Host "[1/6] Using Python runtime: $PythonExe" -ForegroundColor Yellow
& $PythonExe --version

# 2. Verify Build Dependencies
Write-Host "`n[2/6] Verifying build & packaging dependencies..." -ForegroundColor Yellow
& $PythonExe -m pip install -r ../../requirements.txt pyinstaller --quiet

# 3. Execute Automated Verification Test Suite
Write-Host "`n[3/6] Running automated test suite before compilation..." -ForegroundColor Yellow
& $PythonExe -m pytest ../../tests ../../collector/tests -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Test suite failed! Aborting packaging pipeline." -ForegroundColor Red
    exit 1
}
Write-Host "All tests passed successfully!" -ForegroundColor Green

# 4. Clean Previous Artifacts
Write-Host "`n[4/6] Cleaning previous build outputs..." -ForegroundColor Yellow
if (Test-Path "..\..\build") { Remove-Item -Recurse -Force "..\..\build" }
if (Test-Path "..\..\dist\Velocity-Cicada-Collector") { Remove-Item -Recurse -Force "..\..\dist\Velocity-Cicada-Collector" }

# 5. Build Executables with PyInstaller
Write-Host "`n[5/6] Compiling windowless Service & Tray binaries with PyInstaller..." -ForegroundColor Yellow
& $PythonExe -m PyInstaller velocity-cicada.spec --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] PyInstaller compilation failed!" -ForegroundColor Red
    exit 1
}

$ServiceExe = "..\..\dist\Velocity-Cicada-Collector\Velocity-Cicada-Collector.exe"
$TrayExe = "..\..\dist\Velocity-Cicada-Collector\Velocity-Cicada-Tray.exe"

if (-not (Test-Path $ServiceExe)) {
    Write-Host "[ERROR] Service executable '$ServiceExe' was not generated!" -ForegroundColor Red
    exit 1
}
Write-Host "Service Binary compiled: $ServiceExe" -ForegroundColor Green
Write-Host "Tray Companion compiled: $TrayExe" -ForegroundColor Green

# 6. Package with Inno Setup
Write-Host "`n[6/6] Packaging installer with Inno Setup compiler..." -ForegroundColor Yellow

$IsccCandidates = @(
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    "ISCC.exe"
)

$IsccPath = $null
foreach ($candidate in $IsccCandidates) {
    if (Test-Path $candidate -ErrorAction SilentlyContinue) {
        $IsccPath = $candidate
        break
    } elseif (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $IsccPath = $candidate
        break
    }
}

if ($IsccPath) {
    Write-Host "Found Inno Setup Compiler: $IsccPath" -ForegroundColor Green
    if (-not (Test-Path "..\..\dist\installer")) { New-Item -ItemType Directory -Path "..\..\dist\installer" -Force | Out-Null }

    & $IsccPath "Velocity-Cicada-Collector.iss"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Inno Setup compilation failed!" -ForegroundColor Red
        exit 1
    }

    $InstallerPath = Resolve-Path "..\..\dist\installer\Velocity-Cicada-Collector-Setup.exe" -ErrorAction SilentlyContinue
    if ($InstallerPath -and (Test-Path $InstallerPath)) {
        $SizeMB = [math]::Round((Get-Item $InstallerPath).Length / 1MB, 2)
        Write-Host "`n==============================================================================" -ForegroundColor Green
        Write-Host "   BUILD AND PACKAGING COMPLETE!" -ForegroundColor Green
        Write-Host "==============================================================================" -ForegroundColor Green
        Write-Host "  Setup Installer : $InstallerPath" -ForegroundColor White
        Write-Host "  Installer Size  : $SizeMB MB" -ForegroundColor White
        Write-Host "  Bundle Folder   : $(Resolve-Path '..\..\dist\Velocity-Cicada-Collector')" -ForegroundColor White
        Write-Host "==============================================================================`n" -ForegroundColor Green
        exit 0
    }
} else {
    Write-Host "[WARNING] Inno Setup compiler (ISCC.exe) not found on PATH." -ForegroundColor Yellow
    Write-Host "Standalone binary bundle successfully generated at:" -ForegroundColor Yellow
    Write-Host "  -> $(Resolve-Path '..\..\dist\Velocity-Cicada-Collector')" -ForegroundColor White
    Write-Host "Install Inno Setup 6 to compile the setup wizard installer." -ForegroundColor Yellow
    exit 0
}
