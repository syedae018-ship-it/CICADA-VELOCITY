# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller Specification for CICADA Local Collector.

Packages the Python application into a standalone Windows executable.
"""

import sys
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

hidden_imports = [
    'collector',
    'collector.gui',
    'collector.paths',
    'collector.config',
    'collector.metrics',
    'collector.health',
    'collector.network_probe',
    'collector.security',
    'collector.identity',
    'collector.privacy',
    'collector.redaction',
    'collector.buffer',
    'collector.supabase_client',
    'collector.enrollment',
    'collector.payload',
    'collector.subprocess_util',
    'collector.system_info',
    'psutil',
    'sqlite3',
    'tkinter',
    'tkinter.ttk',
    'urllib.request',
    'urllib.error',
]

a = Analysis(
    ['collector/main.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest', 'unittest'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='CICADA-Collector',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # Windowed desktop application (noconsole)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='CICADA-Collector',
)
