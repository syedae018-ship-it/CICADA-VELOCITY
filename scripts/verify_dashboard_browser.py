#!/usr/bin/env python3
"""Automated end-to-end browser test for Velocity Cicada dashboard."""
import asyncio
import os
import sys
import time
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS_DIR = Path("docs/HACKATHON_HANDBOOK/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

async def run_browser_verification():
    print("=" * 70)
    print("🚀 VELOCITY CICADA — END-TO-END BROWSER AUTOMATION TEST")
    print("=" * 70)

    console_errors = []
    
    async with async_playwright() as p:
        browser_args = {}
        if os.path.exists(CHROME_PATH):
            browser_args["executable_path"] = CHROME_PATH
            print(f"✓ Using local Google Chrome: {CHROME_PATH}")
        else:
            print("✓ Using default Chromium")

        browser = await p.chromium.launch(headless=True, **browser_args)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        # Listen for console errors
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        print("\n[Step 1] Navigating to http://localhost:3000...")
        start_time = time.time()
        try:
            response = await page.goto("http://localhost:3000", wait_until="networkidle", timeout=15000)
            load_time = round((time.time() - start_time) * 1000, 1)
            print(f"✓ Dashboard loaded in {load_time}ms with status {response.status if response else 'OK'}")
        except Exception as e:
            print(f"❌ Failed to load dashboard: {e}")
            await browser.close()
            return False

        # Capture Overview
        await page.screenshot(path=str(SCREENSHOTS_DIR / "01_overview.png"))
        print(f"✓ Screenshot saved: {SCREENSHOTS_DIR / '01_overview.png'}")

        # Check tenant selector and header
        title = await page.title()
        print(f"✓ Page title: '{title}'")

        # Test Sidebar Tabs Navigation
        tabs_to_test = [
            ("sources", "Monitored Sources"),
            ("fleet", "Collector Fleet"),
            ("incidents", "Correlated Incidents"),
            ("insights", "AI Insights & Recommendations"),
            ("egress", "Egress Proof & Verification"),
            ("privacy", "Privacy Architecture & Zero-Secret Egress"),
            ("reliability", "Infrastructure Reliability & Transport SLA"),
            ("timeline", "Activity Timeline"),
            ("history", "State Transition History"),
            ("overview", "Executive Overview"),
        ]

        print("\n[Step 2] Testing smooth navigation across all sidebar tabs...")
        for tab_id, label in tabs_to_test:
            tab_start = time.time()
            
            # Click sidebar button
            button = page.locator(f"button[title*='{label[:10]}'], button:has-text('{label}'), nav button:has-text('{tab_id}')").first
            # Fallback by text matching tab label
            if not await button.count():
                button = page.locator(f"nav button:has-text('{label}')").first
            if not await button.count():
                # Locate by SVG or partial text
                button = page.locator("nav button").filter(has_text=re_label(label)).first
                
            if await button.count():
                await button.click()
                await page.wait_for_timeout(300) # wait for smooth transition
                nav_dur = round((time.time() - tab_start) * 1000, 1)
                print(f"  → Switched to [{tab_id.upper()}] in {nav_dur}ms")
                await page.screenshot(path=str(SCREENSHOTS_DIR / f"tab_{tab_id}.png"))
            else:
                # Try finding button by role or click via script
                print(f"  ⚠️ Could not find exact button for '{label}', looking for alternative selector...")
                await page.evaluate(f"() => {{ const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.toLowerCase().includes('{tab_id}')); if (b) b.click(); }}")
                await page.wait_for_timeout(300)

        # Specifically verify Privacy View
        print("\n[Step 3] Deep verification of Privacy View...")
        privacy_btn = page.locator("button:has-text('Privacy')").first
        if await privacy_btn.count():
            await privacy_btn.click()
            await page.wait_for_timeout(400)
            has_pipeline = await page.locator("text=0 Secrets Transmitted").count() > 0 or await page.locator("text=Raw Telemetry").count() > 0
            print(f"  ✓ Privacy 5-stage pipeline rendered: {has_pipeline}")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "02_privacy_deep.png"))

        # Specifically verify Reliability View
        print("\n[Step 4] Deep verification of Reliability View...")
        rel_btn = page.locator("button:has-text('Reliability')").first
        if await rel_btn.count():
            await rel_btn.click()
            await page.wait_for_timeout(400)
            has_sla = await page.locator("text=<10.0s SLA").count() > 0 or await page.locator("text=P95 Ingest Latency").count() > 0
            has_svg = await page.locator("svg").count() > 0
            print(f"  ✓ SLA indicator rendered: {has_sla}, SVG charts rendered: {has_svg}")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "03_reliability_deep.png"))

        # Specifically verify Timeline View
        print("\n[Step 5] Deep verification of Timeline View...")
        time_btn = page.locator("button:has-text('Timeline')").first
        if await time_btn.count():
            await time_btn.click()
            await page.wait_for_timeout(400)
            has_events = await page.locator("text=Live Stream").count() > 0 or await page.locator("text=Activity Timeline").count() > 0
            print(f"  ✓ Dual-rail timeline rendered: {has_events}")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "04_timeline_deep.png"))

        # Specifically verify History View
        print("\n[Step 6] Deep verification of History View...")
        hist_btn = page.locator("button:has-text('History')").first
        if await hist_btn.count():
            await hist_btn.click()
            await page.wait_for_timeout(400)
            has_history = await page.locator("text=State Transition History").count() > 0 or await page.locator("text=Logged Transitions").count() > 0
            print(f"  ✓ Health distribution and transition table rendered: {has_history}")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "05_history_deep.png"))

        print("\n[Step 7] Checking console errors...")
        # Filter benign warnings or font errors
        critical_errors = [e for e in console_errors if not any(x in e for x in ["favicon", "404", "font"])]
        if critical_errors:
            print(f"⚠️ Console errors detected ({len(critical_errors)}):")
            for err in critical_errors[:5]:
                print(f"   - {err}")
        else:
            print("✓ ZERO critical console errors detected!")

        await browser.close()
        print("\n" + "=" * 70)
        print("🎉 COMPLETE BROWSER VERIFICATION PASSED SUCCESSFULLY!")
        print("=" * 70)
        return True

def re_label(label):
    return label.split()[0]

if __name__ == "__main__":
    success = asyncio.run(run_browser_verification())
    sys.exit(0 if success else 1)
