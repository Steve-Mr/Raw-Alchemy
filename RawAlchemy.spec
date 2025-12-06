# -*- mode: python ; coding: utf-8 -*-
import sys

# --- Platform-specific settings ---
# Enable strip on Linux and macOS for a smaller executable.
# On Windows, stripping can sometimes cause issues with antivirus software
# or runtime behavior, so it's safer to leave it disabled.
strip_executable = True if sys.platform.startswith('linux') or sys.platform == 'darwin' else False


a = Analysis(
    ['src/raw_alchemy/gui.py'],
    pathex=[],
    binaries=[],
    datas=[('src/raw_alchemy/vendor', 'vendor'), ('icon.ico', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'pandas',
        'IPython',
        'PyQt5',
        'PySide2',
        'qtpy',
        'test',
        'doctest',
        'distutils',
        'setuptools',
        'wheel',
        'pkg_resources',
        'Cython',
        'PyInstaller',
    ],
    noarchive=False,
    optimize=1,
)
pyz = PYZ(a.pure)

# Platform-specific EXE and BUNDLE for macOS .app creation
if sys.platform == 'darwin':
    # For macOS, create a one-folder bundle (.app)
    exe = EXE(
        pyz,
        a.scripts,
        [],
        name='RawAlchemy',
        debug=False,
        bootloader_ignore_signals=False,
        strip=strip_executable,
        upx=False,
        runtime_tmpdir=None,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon='icon.icns',
    )
    coll = COLLECT(
        exe,
        a.binaries,
        a.datas,
        strip=strip_executable,
        upx=False,
        name='RawAlchemy',
    )
    app = BUNDLE(
        coll,
        name='RawAlchemy.app',
        icon='icon.icns',
        bundle_identifier=None,
    )
else:
    # For Windows and Linux, create a one-file executable
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.datas,
        [],
        name='RawAlchemy',
        debug=False,
        bootloader_ignore_signals=False,
        strip=strip_executable,
        upx=False,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon='icon.ico',
    )
