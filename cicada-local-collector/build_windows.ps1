# ==============================================================================
# CICADA Local Collector - Windows Build and Packaging Script
# ==============================================================================
# Builds the standalone Windows application and Inno Setup installer.
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "   CICADA Local Collector - Windows Build and Packaging Pipeline" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

# 1. Determine Working Python Executable
$PythonExe = "python"
if (Test-Path "C:\Users\iammo\AppData\Local\Python\bin\python.exe") {
    $PythonExe = "C:\Users\iammo\AppData\Local\Python\bin\python.exe"
} elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
    $cand = (Get-Command "python").Source
    if ($cand -notlike "*WindowsApps*") {
        $PythonExe = $cand
    }
}

Write-Host "[1/6] Using Python: $PythonExe" -ForegroundColor Yellow
& $PythonExe --version

# 2. Install Build Dependencies
Write-Host "`n[2/6] Verifying build dependencies..." -ForegroundColor Yellow
& $PythonExe -m pip install -r requirements-build.txt --quiet

# 3. Run Automated Tests
Write-Host "`n[3/6] Running automated unit test suite..." -ForegroundColor Yellow
& $PythonExe -m unittest discover -s tests -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Unit tests failed! Aborting build pipeline." -ForegroundColor Red
    exit 1
}
Write-Host "All tests passed successfully!" -ForegroundColor Green

# 4. Clean Previous Build Artifacts
Write-Host "`n[4/6] Cleaning previous build artifacts..." -ForegroundColor Yellow
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "dist\CICADA-Collector") { Remove-Item -Recurse -Force "dist\CICADA-Collector" }

# 5. Build Application via PyInstaller
Write-Host "`n[5/6] Building standalone executable with PyInstaller..." -ForegroundColor Yellow
& $PythonExe -m PyInstaller cicada-collector.spec --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] PyInstaller compilation failed!" -ForegroundColor Red
    exit 1
}

$ExePath = "dist\CICADA-Collector\CICADA-Collector.exe"
if (-not (Test-Path $ExePath)) {
    Write-Host "[ERROR] Output binary '$ExePath' not found after build!" -ForegroundColor Red
    exit 1
}
Write-Host "PyInstaller build succeeded: $ExePath" -ForegroundColor Green

# 6. Package with Inno Setup
Write-Host "`n[6/6] Packaging installer with Inno Setup..." -ForegroundColor Yellow

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
    Write-Host "Found Inno Setup Compiler at: $IsccPath" -ForegroundColor Green
    if (-not (Test-Path "dist\installer")) { New-Item -ItemType Directory -Path "dist\installer" -Force | Out-Null }
    # Remove older installers so only the freshly built version is left
    Remove-Item "dist\installer\CICADA-Local-Collector-Setup*.exe" -Force -ErrorAction SilentlyContinue
    
    & $IsccPath "installer\CICADA-Collector.iss"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Inno Setup compilation failed!" -ForegroundColor Red
        exit 1
    }

    $InstallerPath = Get-ChildItem "dist\installer\CICADA-Local-Collector-Setup-v*.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
    if ($InstallerPath -and (Test-Path $InstallerPath)) {
        $SizeMB = [math]::Round((Get-Item $InstallerPath).Length / 1MB, 2)
        Write-Host "`n==============================================================================" -ForegroundColor Green
        Write-Host "   BUILD AND PACKAGING COMPLETE!" -ForegroundColor Green
        Write-Host "==============================================================================" -ForegroundColor Green
        Write-Host "  Final Setup Installer : $InstallerPath" -ForegroundColor White
        Write-Host "  Installer File Size   : $SizeMB MB" -ForegroundColor White
        Write-Host "  Standalone App Bundle : $(Resolve-Path 'dist\CICADA-Collector')" -ForegroundColor White
        Write-Host "==============================================================================`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[ERROR] Installer executable was not generated at expected path." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[WARNING] Inno Setup compiler (ISCC.exe) was not found." -ForegroundColor Yellow
    Write-Host "The standalone application bundle was successfully created at:" -ForegroundColor Yellow
    Write-Host "  -> $(Resolve-Path 'dist\CICADA-Collector')" -ForegroundColor White
    Write-Host "To compile the setup installer, install Inno Setup and re-run this script." -ForegroundColor Yellow
    exit 0
}
