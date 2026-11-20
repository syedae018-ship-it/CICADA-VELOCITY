"""Velocity Cicada — Enterprise Windows Service & Daemon Manager.

Provides comprehensive Windows Service lifecycle management:
- Service execution mode (--service)
- Windows Service installation (--install via sc.exe / win32service)
- Windows Service uninstallation (--uninstall)
- Start / Stop / Restart / Status commands
- Controlled recovery configuration (prevents rapid restart loops)
- Single-Instance named mutex protection
- Rotating structured log management (max 5MB, 5 backups)
- Windows DPAPI credential protection
- Graceful shutdown signal handling (SIGTERM, SIGINT, SetConsoleCtrlHandler)
"""

import argparse
import asyncio
import logging
from logging.handlers import RotatingFileHandler
import os
import platform
import signal
import sys
import time
from pathlib import Path
from typing import Optional

from collector import config
from collector.mutex import SingleInstanceLock
from collector.subprocess_util import safe_run_subprocess

SERVICE_NAME = "VelocityCicadaCollector"
SERVICE_DISPLAY_NAME = "Velocity Cicada Collector Service"
SERVICE_DESCRIPTION = "Velocity Cicada continuous host observability and AIOps telemetry collector service."


def get_log_directory() -> Path:
    """Resolve standard application log directory."""
    if platform.system() == "Windows":
        prog_data = os.getenv("ProgramData", "C:\\ProgramData")
        log_dir = Path(prog_data) / "VelocityCicada" / "logs"
    else:
        log_dir = Path(os.path.expanduser("~/.config/velocity-cicada/logs"))
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def setup_service_logging(log_filename: str = "collector-service.log") -> logging.Logger:
    """Configure rotating structured file logging."""
    log_dir = get_log_directory()
    log_path = log_dir / log_filename

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # Clear existing handlers to avoid duplicates
    for h in list(logger.handlers):
        logger.removeHandler(h)

    # 1. Rotating File Handler (5 MB per file, max 5 backups)
    file_handler = RotatingFileHandler(
        str(log_path),
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    formatter = logging.Formatter(
        "[%(asctime)s] [%(process)d] [%(levelname)s] [%(name)s] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # 2. Console handler only if attached to an active terminal
    if sys.stdout and hasattr(sys.stdout, "isatty") and sys.stdout.isatty():
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    logger.info("Structured rotating logging initialized at: %s", log_path)
    return logger


def install_windows_service(exe_path: Optional[str] = None) -> bool:
    """Register the Windows Service using sc.exe with automatic start and recovery controls."""
    if platform.system() != "Windows":
        print(f"[INFO] Windows Service installation is only available on Windows. Current platform: {platform.system()}")
        return False

    bin_path = exe_path or sys.executable
    if not getattr(sys, "frozen", False):
        bin_arg = f'"{bin_path}" "{os.path.abspath(__file__)}" --service'
    else:
        bin_arg = f'"{bin_path}" --service'

    print(f"[*] Registering Windows Service '{SERVICE_NAME}'...")
    print(f"[*] Binary Path: {bin_arg}")

    # 1. Create service with Automatic startup
    create_cmd = [
        "sc.exe", "create", SERVICE_NAME,
        f"binPath= {bin_arg}",
        "start= auto",
        f"DisplayName= {SERVICE_DISPLAY_NAME}",
    ]
    res = safe_run_subprocess(create_cmd)
    if res.returncode != 0:
        print(f"[ERROR] Failed to create service: {res.stderr or res.stdout}")
        return False

    # 2. Set description
    desc_cmd = ["sc.exe", "description", SERVICE_NAME, SERVICE_DESCRIPTION]
    safe_run_subprocess(desc_cmd)

    # 3. Configure recovery failure actions:
    # restart after 5s on 1st crash, 10s on 2nd crash, 30s on 3rd crash; reset failure counter after 86400s (24h)
    # This prevents tight repeated restart loops while guaranteeing recovery!
    fail_cmd = [
        "sc.exe", "failure", SERVICE_NAME,
        "reset= 86400",
        "actions= restart/5000/restart/10000/restart/30000",
    ]
    safe_run_subprocess(fail_cmd)

    print(f"[SUCCESS] Windows Service '{SERVICE_NAME}' successfully installed with recovery controls.")
    return True


def uninstall_windows_service() -> bool:
    """Stop and delete the Windows Service cleanly without deleting user data."""
    if platform.system() != "Windows":
        print(f"[INFO] Windows Service management is only available on Windows.")
        return False

    print(f"[*] Stopping Windows Service '{SERVICE_NAME}'...")
    safe_run_subprocess(["sc.exe", "stop", SERVICE_NAME])
    time.sleep(1)

    print(f"[*] Removing Windows Service '{SERVICE_NAME}' registration...")
    res = safe_run_subprocess(["sc.exe", "delete", SERVICE_NAME])
    if res.returncode == 0:
        print(f"[SUCCESS] Service '{SERVICE_NAME}' removed successfully.")
        return True
    else:
        print(f"[WARNING] sc.exe delete returned: {res.stderr or res.stdout}")
        return False


def start_service() -> bool:
    """Start the registered Windows Service or daemon process."""
    if platform.system() == "Windows":
        res = safe_run_subprocess(["sc.exe", "start", SERVICE_NAME])
        if res.returncode == 0:
            print(f"[SUCCESS] Windows Service '{SERVICE_NAME}' started.")
            return True
        else:
            print(f"[ERROR] Failed to start service: {res.stderr or res.stdout}")
            return False
    else:
        print(f"[INFO] To run as a background daemon on Unix, execute with --service in background.")
        return True


def stop_service() -> bool:
    """Stop the registered Windows Service."""
    if platform.system() == "Windows":
        res = safe_run_subprocess(["sc.exe", "stop", SERVICE_NAME])
        if res.returncode == 0:
            print(f"[SUCCESS] Windows Service '{SERVICE_NAME}' stopped.")
            return True
        else:
            print(f"[WARNING] Stop command returned: {res.stderr or res.stdout}")
            return False
    return True


def query_service_status() -> dict:
    """Query live service status from local API or Windows SCM."""
    import urllib.request
    import json

    status_data = {
        "service_name": SERVICE_NAME,
        "platform": platform.system(),
        "is_running": False,
        "collector_id": config.COLLECTOR_ID,
        "tenant_id": config.TENANT_ID,
        "region": config.REGION,
        "saas_reachable": False,
        "buffer_depth": 0,
        "uptime_s": 0,
    }

    # First check local REST API
    try:
        url = f"http://127.0.0.1:{config.settings.PORT}/local/status"
        req = urllib.request.Request(url, headers={"User-Agent": "VelocityCicada-CLI"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            if resp.status == 200:
                body = json.loads(resp.read().decode("utf-8"))
                status_data.update(body)
                status_data["is_running"] = True
                return status_data
    except Exception:
        pass

    # On Windows, check Service Control Manager
    if platform.system() == "Windows":
        res = safe_run_subprocess(["sc.exe", "query", SERVICE_NAME])
        if res.returncode == 0 and "RUNNING" in res.stdout:
            status_data["is_running"] = True
            status_data["scm_status"] = "RUNNING"
        elif res.returncode == 0 and "STOPPED" in res.stdout:
            status_data["scm_status"] = "STOPPED"
        else:
            status_data["scm_status"] = "NOT_INSTALLED"

    return status_data


def run_service_main(host: str = "127.0.0.1", port: Optional[int] = None) -> None:
    """Execute the core collector background service with single-instance lock."""
    logger = setup_service_logging()
    logger.info("Initializing %s v%s background daemon...", SERVICE_NAME, config.VERSION)

    # 1. Enforce Single-Instance Protection
    lock = SingleInstanceLock("VelocityCicadaCollector_Service_Mutex")
    if not lock.acquire():
        logger.error("Single-instance check failed: Another collector process is already running. Exiting.")
        sys.exit(0)

    # 2. Register clean shutdown handlers
    shutdown_event = asyncio.Event()

    def _signal_handler(sig, frame):
        logger.info("Received termination signal (%s). Initiating graceful shutdown...", sig)
        shutdown_event.set()

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    if platform.system() == "Windows":
        try:
            import ctypes
            from ctypes import wintypes
            HandlerRoutine = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)
            def _win_ctrl_handler(dwCtrlType):
                logger.info("Windows Console/Service Ctrl Event received: %d. Shutting down cleanly...", dwCtrlType)
                shutdown_event.set()
                return True
            _global_ctrl_handler = HandlerRoutine(_win_ctrl_handler)
            ctypes.windll.kernel32.SetConsoleCtrlHandler(_global_ctrl_handler, True)
        except Exception as e:
            logger.debug("Could not register SetConsoleCtrlHandler: %s", e)

    # 3. Launch Uvicorn / FastAPI server in asyncio loop
    import uvicorn
    from collector.app import app

    effective_port = port or config.settings.PORT
    logger.info("Starting collector API and telemetry engine on %s:%d...", host, effective_port)

    uvicorn_config = uvicorn.Config(
        app=app,
        host=host,
        port=effective_port,
        log_level="info",
        access_log=False,
    )
    server = uvicorn.Server(uvicorn_config)

    async def _runner():
        async def _check_shutdown():
            await shutdown_event.wait()
            logger.info("Shutdown event triggered. Stopping uvicorn server...")
            server.should_exit = True

        asyncio.create_task(_check_shutdown())
        await server.serve()

    try:
        asyncio.run(_runner())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Collector process stopped.")
    except Exception as exc:
        logger.exception("Unexpected error in collector service: %s", exc)
    finally:
        lock.release()
        logger.info("Collector lock released. Shutdown complete.")


def handle_enrollment(saas_url: str, enrollment_token: str, tenant_id: Optional[str] = None, region: Optional[str] = None) -> bool:
    """Perform automatic collector registration with SaaS backend."""
    import urllib.request
    import json

    print(f"[*] Enrolling collector with SaaS backend at: {saas_url}")
    enroll_endpoint = f"{saas_url.rstrip('/')}/api/v1/enroll"

    req_data = {
        "enrollment_token": enrollment_token,
        "hostname": socket_hostname := platform.node(),
        "os_name": platform.system(),
    }
    if tenant_id:
        req_data["tenant_id"] = tenant_id
    if region:
        req_data["region"] = region

    try:
        req_bytes = json.dumps(req_data).encode("utf-8")
        req = urllib.request.Request(
            enroll_endpoint,
            data=req_bytes,
            headers={"Content-Type": "application/json", "User-Agent": "VelocityCicada-Installer"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            if resp.status == 200:
                res_body = json.loads(resp.read().decode("utf-8"))
                cid = res_body["collector_id"]
                csec = res_body["collector_secret"]
                tid = res_body["tenant_id"]
                reg = res_body["region"]

                print(f"[SUCCESS] Collector enrolled successfully!")
                print(f"  Collector ID : {cid}")
                print(f"  Tenant ID    : {tid}")
                print(f"  Region       : {reg}")

                # Save to configuration file with DPAPI protection
                cfg_path = Path("C:\\ProgramData\\VelocityCicada\\config.json") if platform.system() == "Windows" else Path(os.path.expanduser("~/.config/velocity-cicada/config.json"))
                config.settings.COLLECTOR_ID = cid
                config.settings.COLLECTOR_SECRET = csec
                config.settings.TENANT_ID = tid
                config.settings.REGION = reg
                config.settings.SAAS_URL = saas_url
                config.settings.save_to_file(cfg_path)
                print(f"[SUCCESS] Configuration saved securely with DPAPI to: {cfg_path}")
                return True
            else:
                print(f"[ERROR] Enrollment failed: HTTP {resp.status}")
                return False
    except Exception as e:
        print(f"[ERROR] Enrollment request failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description=f"{SERVICE_DISPLAY_NAME} — Enterprise Background Observability Agent."
    )
    parser.add_argument("--service", action="store_true", help="Run in background Windows Service / daemon mode.")
    parser.add_argument("--install", action="store_true", help="Install Windows Service with automatic start and recovery.")
    parser.add_argument("--uninstall", action="store_true", help="Stop and uninstall Windows Service cleanly.")
    parser.add_argument("--start", action="store_true", help="Start the Windows Service.")
    parser.add_argument("--stop", action="store_true", help="Stop the Windows Service.")
    parser.add_argument("--restart", action="store_true", help="Restart the Windows Service.")
    parser.add_argument("--status", action="store_true", help="Display service and cloud connectivity status.")
    parser.add_argument("--enroll", type=str, default=None, help="Enroll this collector with SaaS using an authorized token.")
    parser.add_argument("--saas-url", type=str, default=None, help="SaaS backend URL (default: http://localhost:8000).")
    parser.add_argument("--tenant-id", type=str, default=None, help="Tenant UUID/identifier.")
    parser.add_argument("--region", type=str, default=None, help="Regional cloud endpoint.")
    parser.add_argument("--port", type=int, default=None, help="Local collector API port (default: 8001).")

    args = parser.parse_args()

    if args.install:
        success = install_windows_service()
        sys.exit(0 if success else 1)

    if args.uninstall:
        success = uninstall_windows_service()
        sys.exit(0 if success else 1)

    if args.start:
        success = start_service()
        sys.exit(0 if success else 1)

    if args.stop:
        success = stop_service()
        sys.exit(0 if success else 1)

    if args.restart:
        stop_service()
        time.sleep(1)
        success = start_service()
        sys.exit(0 if success else 1)

    if args.status:
        st = query_service_status()
        import json
        print(json.dumps(st, indent=2))
        sys.exit(0)

    if args.enroll:
        url = args.saas_url or config.settings.SAAS_URL
        success = handle_enrollment(
            saas_url=url,
            enrollment_token=args.enroll,
            tenant_id=args.tenant_id,
            region=args.region,
        )
        sys.exit(0 if success else 1)

    # Default action or --service:
    run_service_main(port=args.port)


if __name__ == "__main__":
    main()
