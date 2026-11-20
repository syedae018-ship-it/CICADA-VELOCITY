; ==============================================================================
; CICADA Local Collector — Inno Setup Installer Script
; ==============================================================================
; Produces: CICADA-Local-Collector-Setup.exe
; Features:
; - Standard Windows installation directory: {autopf}\CICADA Local Collector
; - Desktop & Start Menu shortcuts
; - Clean uninstaller registered in Windows Add/Remove Programs
; - Preserves customer configuration and persistent Device ID in AppData
; ==============================================================================

#define MyAppName "CICADA Local Collector"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "CICADA Observability"
#define MyAppExeName "CICADA-Collector.exe"

[Setup]
AppId={{E6819614-72D4-490C-B7D4-71F4AC12D38A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist\installer
OutputBaseFilename=CICADA-Local-Collector-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Copy all binaries and dependencies built by PyInstaller
Source: "..\dist\CICADA-Collector\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu Shortcut
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
; Desktop Shortcut
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Option to launch application immediately after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up temp files in app directory if any, but DO NOT delete user AppData
Type: filesandordirs; Name: "{app}\*.*"
