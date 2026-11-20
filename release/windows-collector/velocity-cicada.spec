# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller Specification for Velocity Cicada Collector & Tray Companion.

Produces two production Windows executables:
1. Velocity-Cicada-Collector.exe (Windows Service / background telemetry engine)
2. Velocity-Cicada-Tray.exe (Desktop Status Tray companion)
"""

import sys
import os
from pathlib import Path

block_cipher = None

# Hidden imports required by FastAPI, Uvicorn, SQLite, and psutil
collector_hidden_imports = [
    'collector',
    'collector.config',
    'collector.app',
    'collector.routes',
    'collector.store',
    'collector.aggregate',
    'collector.detect',
    'collector.pseudo',
    'collector.redact',
    'collector.host_collector',
    'collector.windows_service',
    'collector.mutex',
    'collector.dpapi',
    'collector.subprocess_util',
    'collector.demo_driver',
    'transport',
    'transport.db',
    'transport.signing',
    'transport.sender',
    'transport.router',
    'psutil',
    'sqlite3',
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'httpx',
    'fastapi',
    'pydantic',
    'jsonschema',
]

tray_hidden_imports = [
    'collector',
    'collector.config',
    'collector.tray',
    'tkinter',
    'tkinter.ttk',
    'urllib.request',
    'urllib.error',
]

# Include JSON contract schema assets
datas = [
    ('../../contracts/payload_schema.json', 'contracts'),
    ('../../contracts/heartbeat_schema.json', 'contracts'),
    ('../../contracts/redaction_rules.json', 'contracts'),
]

# 1. Main Service & Engine Analysis
a_service = Analysis(
    ['../../collector/windows_service.py'],
    pathex=['../..'],
    binaries=[],
    datas=datas,
    hiddenimports=collector_hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest', 'unittest'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz_service = PYZ(a_service.pure, a_service.zipped_data, cipher=block_cipher)

exe_service = EXE(
    pyz_service,
    a_service.scripts,
    [],
    exclude_binaries=True,
    name='Velocity-Cicada-Collector',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # Windowless: NEVER flashes a console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# 2. Tray Companion Analysis
a_tray = Analysis(
    ['../../collector/tray.py'],
    pathex=['../..'],
    binaries=[],
    datas=[],
    hiddenimports=tray_hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest', 'unittest'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz_tray = PYZ(a_tray.pure, a_tray.zipped_data, cipher=block_cipher)

exe_tray = EXE(
    pyz_tray,
    a_tray.scripts,
    [],
    exclude_binaries=True,
    name='Velocity-Cicada-Tray',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # Windowless desktop companion
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# 3. Unified Distribution Bundle
coll = COLLECT(
    exe_service,
    a_service.binaries,
    a_service.zipfiles,
    a_service.datas,
    exe_tray,
    a_tray.binaries,
    a_tray.zipfiles,
    a_tray.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Velocity-Cicada-Collector',
)
