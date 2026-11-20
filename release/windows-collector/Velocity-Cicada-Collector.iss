; ==============================================================================
; Velocity Cicada Local Collector — Enterprise Inno Setup Installer Script
; ==============================================================================
; Produces: Velocity-Cicada-Collector-Setup.exe
;
; Enterprise Features:
; - Velocity Cicada official branding & modern wizard styling
; - Standard 64-bit Program Files installation: {autopf}\Velocity Cicada Collector
; - Custom Setup Wizard page collecting SaaS URL, Tenant, Region & Credentials
; - Configurable transmission interval (60s default / 30s)
; - Automated Windows Service registration with 'auto' startup
; - Failure recovery policy (restart after 5s/10s/30s; reset after 24h)
; - System Tray Status companion integrated into Windows Startup
; - Clean uninstaller stopping and removing service, preserving customer AppData
; ==============================================================================

#define MyAppName "Velocity Cicada Collector"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Velocity Cicada Observability"
#define MyAppURL "https://velocitycicada.com"
#define MyAppExeName "Velocity-Cicada-Collector.exe"
#define MyTrayExeName "Velocity-Cicada-Tray.exe"
#define MyServiceName "VelocityCicadaCollector"

[Setup]
AppId={{E6819614-72D4-490C-B7D4-71F4AC12D38A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\..\dist\installer
OutputBaseFilename=Velocity-Cicada-Collector-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupIconFile=compiler:SetupClassicIcon.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "startupservice"; Description: "Register and start Velocity Cicada as a Windows Service (Recommended)"; GroupDescription: "Windows Service Configuration:"; Flags: checkedonce
Name: "startuptray"; Description: "Launch Status Tray companion on Windows startup"; GroupDescription: "User Experience:"
Name: "desktopicon"; Description: "Create Desktop shortcut for Status Tray companion"; GroupDescription: "Additional Icons:"

[Files]
; Copy all compiled binaries and dependencies built by PyInstaller
Source: "..\..\dist\Velocity-Cicada-Collector\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu Shortcuts
Name: "{autoprograms}\{#MyAppName}\Velocity Cicada Status"; Filename: "{app}\{#MyTrayExeName}"
Name: "{autoprograms}\{#MyAppName}\Collector Logs"; Filename: "{commonappdata}\VelocityCicada\logs"
Name: "{autoprograms}\{#MyAppName}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

; Desktop Shortcut
Name: "{autodesktop}\Velocity Cicada Status"; Filename: "{app}\{#MyTrayExeName}"; Tasks: desktopicon

; Windows User Startup
Name: "{userstartup}\Velocity-Cicada-Tray"; Filename: "{app}\{#MyTrayExeName}"; Tasks: startuptray

[Run]
; 1. Create and configure Windows Service
Filename: "sc.exe"; Parameters: "create {#MyServiceName} binPath= """"{app}\{#MyAppExeName}"""" --service start= auto DisplayName= ""{#MyAppName}"""; Flags: runhidden; Tasks: startupservice; StatusMsg: "Registering Windows Service..."
Filename: "sc.exe"; Parameters: "description {#MyServiceName} ""Velocity Cicada continuous host observability and AIOps telemetry collector service."""; Flags: runhidden; Tasks: startupservice
Filename: "sc.exe"; Parameters: "failure {#MyServiceName} reset= 86400 actions= restart/5000/restart/10000/restart/30000"; Flags: runhidden; Tasks: startupservice

; 2. Start the Windows Service immediately
Filename: "sc.exe"; Parameters: "start {#MyServiceName}"; Flags: runhidden; Tasks: startupservice; StatusMsg: "Starting Velocity Cicada Collector Service..."

; 3. Optionally launch Tray companion nowait
Filename: "{app}\{#MyTrayExeName}"; Description: "Launch Velocity Cicada Status Monitor now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop and remove the Windows Service before deleting files
Filename: "sc.exe"; Parameters: "stop {#MyServiceName}"; Flags: runhidden
Filename: "sc.exe"; Parameters: "delete {#MyServiceName}"; Flags: runhidden

[UninstallDelete]
; Clean up app files in program directory, but DO NOT delete persistent user data or config in AppData
Type: filesandordirs; Name: "{app}\*.*"

[Code]
var
  ConfigPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  // Create Custom Configuration Page for SaaS Backend Connectivity
  ConfigPage := CreateInputQueryPage(
    wpSelectTasks,
    'Velocity Cicada SaaS Backend Configuration',
    'Configure the connection to your Velocity Cicada SaaS platform or local backend.',
    'Enter your organization connection parameters below. These can also be managed later in config.json.'
  );

  ConfigPage.Add('SaaS Backend URL (e.g. http://localhost:8000 or https://api.velocitycicada.com):', False);
  ConfigPage.Add('Tenant ID (e.g. t_acme or t_globex):', False);
  ConfigPage.Add('Collector ID (e.g. c_win01 or c_blr01):', False);
  ConfigPage.Add('Collector Secret / HMAC Key:', True); // password-masked
  ConfigPage.Add('Cloud Region (ap-south-1, eu-west-1, us-east-1):', False);
  ConfigPage.Add('Transmission Interval in Seconds (60 by default, or 30):', False);

  // Set default values matching Acme demo environment
  ConfigPage.Values[0] := 'http://localhost:8000';
  ConfigPage.Values[1] := 't_acme';
  ConfigPage.Values[2] := 'c_win01';
  ConfigPage.Values[3] := 'dev-secret-c_win01';
  ConfigPage.Values[4] := 'ap-south-1';
  ConfigPage.Values[5] := '60';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigDir: String;
  ConfigFile: String;
  JsonContent: String;
  IntervalVal: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    ConfigDir := ExpandConstant('{commonappdata}\VelocityCicada');
    ForceDirectories(ConfigDir);
    ForceDirectories(ConfigDir + '\logs');
    ForceDirectories(ConfigDir + '\data');

    ConfigFile := ConfigDir + '\config.json';

    IntervalVal := StrToIntDef(ConfigPage.Values[5], 60);
    if (IntervalVal <> 30) and (IntervalVal <> 60) then
      IntervalVal := 60;

    JsonContent := 
      '{' + #13#10 +
      '  "saas_url": "' + ConfigPage.Values[0] + '",' + #13#10 +
      '  "tenant_id": "' + ConfigPage.Values[1] + '",' + #13#10 +
      '  "collector_id": "' + ConfigPage.Values[2] + '",' + #13#10 +
      '  "collector_secret": "plain:' + ConfigPage.Values[3] + '",' + #13#10 +
      '  "region": "' + ConfigPage.Values[4] + '",' + #13#10 +
      '  "transmission_interval_seconds": ' + IntToStr(IntervalVal) + ',' + #13#10 +
      '  "collection_interval_seconds": 10,' + #13#10 +
      '  "service_name": "workstation-host"' + #13#10 +
      '}';

    SaveStringToFile(ConfigFile, JsonContent, False);
  end;
end;
