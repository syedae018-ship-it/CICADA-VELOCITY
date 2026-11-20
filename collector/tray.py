"""Velocity Cicada — Desktop System Tray & Status Companion.

A lightweight, non-intrusive desktop tray application that communicates with
the background Velocity Cicada Collector service.

Features:
- Live status states: Initializing, Connecting, Connected, Collecting, Sending, Offline, Retrying, Error.
- Displays:
    * Velocity Cicada branding
    * Collector status & Cloud connection status
    * Last successful transmission timestamp
    * Last heartbeat timestamp
    * Current buffer depth
    * Collector version
- Menu options:
    * Open Collector Dashboard
    * View Connection Status
    * View Logs
    * Pause Collection / Resume Collection
    * Restart Collector Service
    * Uninstall Instructions
    * Exit Tray
- Strictly decoupled: Closing the tray NEVER stops the background collector service.
"""

import json
import logging
import os
import platform
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from typing import Any, Dict, Optional

logger = logging.getLogger("cicada.tray")


class CollectorStatusClient:
    """HTTP client querying the local background collector API (port 8001)."""

    def __init__(self, port: int = 8001):
        self.base_url = f"http://127.0.0.1:{port}"

    def get_status(self) -> Dict[str, Any]:
        """Fetch live status dictionary from collector service."""
        try:
            req = urllib.request.Request(
                f"{self.base_url}/local/status",
                headers={"User-Agent": "VelocityCicada-Tray"},
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    data["service_available"] = True
                    return data
        except Exception:
            pass

        return {
            "service_available": False,
            "saas_reachable": False,
            "buffer_depth": 0,
            "last_sent_utc": None,
            "uptime_s": 0,
            "version": "1.0.0",
            "collection_paused": False,
        }

    def pause_collection(self) -> bool:
        try:
            req = urllib.request.Request(f"{self.base_url}/local/pause", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                return resp.status == 200
        except Exception:
            return False

    def resume_collection(self) -> bool:
        try:
            req = urllib.request.Request(f"{self.base_url}/local/resume", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                return resp.status == 200
        except Exception:
            return False


def determine_collector_state(status_data: Dict[str, Any]) -> str:
    """Compute the formal operational status state."""
    if not status_data.get("service_available"):
        return "Offline"

    saas_reachable = status_data.get("saas_reachable")
    buffer_depth = status_data.get("buffer_depth", 0)
    collection_paused = status_data.get("collection_paused", False)
    uptime_s = status_data.get("uptime_s", 0)

    if collection_paused:
        return "Paused"

    if uptime_s < 3 and saas_reachable is None:
        return "Initializing"

    if saas_reachable is None:
        return "Connecting"

    if not saas_reachable:
        if buffer_depth > 0:
            return "Retrying"
        return "Offline"

    if buffer_depth > 0:
        return "Sending"

    return "Connected"


def open_dashboard():
    """Launch the Velocity Cicada Dashboard in the user's default browser."""
    dash_url = os.getenv("DASHBOARD_URL", "http://localhost:3000")
    webbrowser.open(dash_url)


def open_logs_folder():
    """Open the application logs folder in Windows Explorer or Finder."""
    if platform.system() == "Windows":
        prog_data = os.getenv("ProgramData", "C:\\ProgramData")
        log_dir = os.path.join(prog_data, "VelocityCicada", "logs")
        if not os.path.exists(log_dir):
            log_dir = os.path.join(os.getenv("LOCALAPPDATA", "C:\\"), "VelocityCicada", "logs")
    else:
        log_dir = os.path.expanduser("~/.config/velocity-cicada/logs")

    os.makedirs(log_dir, exist_ok=True)
    if platform.system() == "Windows":
        os.startfile(log_dir)
    elif platform.system() == "Darwin":
        import subprocess
        subprocess.run(["open", log_dir])
    else:
        import subprocess
        subprocess.run(["xdg-open", log_dir])


class CicadaTrayUI:
    """Tkinter-based native status companion with tray aesthetics."""

    def __init__(self, port: int = 8001):
        self.client = CollectorStatusClient(port=port)
        self.root = None
        self.is_running = True
        self.latest_status: Dict[str, Any] = {}

    def launch(self):
        import tkinter as tk
        from tkinter import messagebox, ttk

        self.root = tk.Tk()
        self.root.title("Velocity Cicada — Collector Status")
        self.root.geometry("480x420")
        self.root.minsize(440, 380)

        # Apply clean dark-themed header
        header = tk.Frame(self.root, bg="#0d1b2a", height=60)
        header.pack(fill=tk.X, side=tk.TOP)
        header.pack_propagate(False)

        title_lbl = tk.Label(
            header,
            text="VELOCITY CICADA  |  Local Collector",
            font=("Segoe UI", 12, "bold"),
            fg="#e0e1dd",
            bg="#0d1b2a",
        )
        title_lbl.pack(side=tk.LEFT, padx=16, pady=16)

        self.badge_lbl = tk.Label(
            header,
            text="INITIALIZING",
            font=("Segoe UI", 9, "bold"),
            fg="#fbbf24",
            bg="#374151",
            padx=10,
            pady=3,
        )
        self.badge_lbl.pack(side=tk.RIGHT, padx=16, pady=16)

        container = ttk.Frame(self.root, padding="15")
        container.pack(fill=tk.BOTH, expand=True)

        # Status Table Frame
        tbl = ttk.LabelFrame(container, text=" Live Observability Status ", padding="10")
        tbl.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        self.fields = {}
        row_idx = 0
        display_keys = [
            ("Collector State", "state"),
            ("SaaS Connection", "saas_conn"),
            ("Collector ID", "collector_id"),
            ("Tenant ID", "tenant_id"),
            ("Cloud Region", "region"),
            ("Transmission Interval", "interval"),
            ("Last Transmission", "last_sent"),
            ("Local Buffer Depth", "buffer_depth"),
            ("Uptime", "uptime"),
            ("Collector Version", "version"),
        ]

        for label_text, key in display_keys:
            f = ttk.Frame(tbl)
            f.pack(fill=tk.X, pady=2)
            ttk.Label(f, text=f"{label_text}:", width=22, font=("Segoe UI", 9)).pack(side=tk.LEFT)
            val_lbl = ttk.Label(f, text="Loading...", font=("Segoe UI", 9, "bold"))
            val_lbl.pack(side=tk.LEFT)
            self.fields[key] = val_lbl
            row_idx += 1

        # Action Buttons Bar
        btn_bar = ttk.Frame(container)
        btn_bar.pack(fill=tk.X, pady=5)

        ttk.Button(btn_bar, text="Open Dashboard", command=open_dashboard).pack(side=tk.LEFT, padx=(0, 4))
        self.btn_pause = ttk.Button(btn_bar, text="Pause Collection", command=self._toggle_pause)
        self.btn_pause.pack(side=tk.LEFT, padx=4)
        ttk.Button(btn_bar, text="View Logs", command=open_logs_folder).pack(side=tk.LEFT, padx=4)
        ttk.Button(btn_bar, text="Uninstall Guide", command=self._show_uninstall_info).pack(side=tk.RIGHT)

        # Footnote
        footnote = ttk.Label(
            container,
            text="* Background collector service runs independently. Closing this window does not stop telemetry.",
            font=("Segoe UI", 8),
            foreground="#6b7280",
        )
        footnote.pack(side=tk.BOTTOM, pady=(8, 0), anchor=tk.W)

        # Start background polling
        self._poll_status()
        self.root.mainloop()

    def _poll_status(self):
        if not self.root:
            return

        def _fetch():
            data = self.client.get_status()
            if self.root:
                self.root.after(0, self._update_ui, data)

        threading.Thread(target=_fetch, daemon=True).start()
        self.root.after(2000, self._poll_status)

    def _update_ui(self, data: Dict[str, Any]):
        self.latest_status = data
        state = determine_collector_state(data)

        # Update Badge Color
        color_map = {
            "Connected": ("#10b981", "#064e3b"),
            "Sending": ("#3b82f6", "#1e3a8a"),
            "Collecting": ("#10b981", "#064e3b"),
            "Retrying": ("#f59e0b", "#451a03"),
            "Offline": ("#ef4444", "#7f1d1d"),
            "Initializing": ("#fbbf24", "#374151"),
            "Connecting": ("#60a5fa", "#1e3a8a"),
            "Paused": ("#9ca3af", "#374151"),
        }
        fg, bg = color_map.get(state, ("#f9fafb", "#374151"))
        self.badge_lbl.config(text=state.upper(), fg=fg, bg=bg)

        # Update Fields
        self.fields["state"].config(text=state)
        saas_str = "ONLINE (Healthy)" if data.get("saas_reachable") else ("OFFLINE (Buffering)" if data.get("service_available") else "SERVICE STOPPED")
        self.fields["saas_conn"].config(text=saas_str)
        self.fields["collector_id"].config(text=data.get("collector_id", "c_win01"))
        self.fields["tenant_id"].config(text=data.get("tenant_id", "t_acme"))
        self.fields["region"].config(text=data.get("region", "ap-south-1"))
        self.fields["interval"].config(text=f"{data.get('transmission_interval_s', 60)} Seconds")
        self.fields["last_sent"].config(text=data.get("last_sent_utc") or "Not yet sent")
        self.fields["buffer_depth"].config(text=f"{data.get('buffer_depth', 0)} payloads pending")

        uptime = data.get("uptime_s", 0)
        mins, secs = divmod(uptime, 60)
        hours, mins = divmod(mins, 60)
        self.fields["uptime"].config(text=f"{hours:02d}h {mins:02d}m {secs:02d}s")
        self.fields["version"].config(text=f"v{data.get('version', '1.0.0')}")

        if data.get("collection_paused"):
            self.btn_pause.config(text="Resume Collection")
        else:
            self.btn_pause.config(text="Pause Collection")

    def _toggle_pause(self):
        paused = self.latest_status.get("collection_paused", False)
        if paused:
            self.client.resume_collection()
        else:
            self.client.pause_collection()

    def _show_uninstall_info(self):
        from tkinter import messagebox
        msg = (
            "To uninstall Velocity Cicada Collector:\n\n"
            "1. Open Windows Settings -> Apps -> Installed Apps (or Control Panel).\n"
            "2. Select 'Velocity Cicada Collector' and click 'Uninstall'.\n\n"
            "The uninstaller will automatically stop and remove the Windows Service.\n"
            "Your persistent device ID and audit records are safely preserved in AppData."
        )
        messagebox.showinfo("Uninstallation Instructions", msg)


def launch_tray():
    """Entry point for launching the companion status application."""
    ui = CicadaTrayUI()
    ui.launch()


if __name__ == "__main__":
    launch_tray()
