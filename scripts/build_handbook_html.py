#!/usr/bin/env python3
"""Builds the single-file executive HTML and PDF handbook for Velocity Cicada."""
import glob
import json
import os
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = BASE_DIR / "docs" / "HACKATHON_HANDBOOK"
OUTPUT_HTML = DOCS_DIR / "Velocity_Cicada_Complete_System_Handbook.html"

FILES = [
    "00_START_HERE.md",
    "01_SYSTEM_OVERVIEW.md",
    "02_ARCHITECTURE.md",
    "03_DATA_FLOW.md",
    "04_PRIVACY_SECURITY.md",
    "05_AIOPS_ENGINE.md",
    "06_API_REFERENCE.md",
    "07_DATABASE_GUIDE.md",
    "08_DASHBOARD_GUIDE.md",
    "09_MANUAL_TESTING.md",
    "10_SCENARIO_TESTING.md",
    "11_FAILURE_RECOVERY.md",
    "12_HACKATHON_QA.md",
    "13_DEMO_SCRIPT.md",
    "14_FEATURE_VERIFICATION.md",
]

content_parts = []
for fname in FILES:
    fpath = DOCS_DIR / fname
    if fpath.exists():
        raw = fpath.read_text(encoding="utf-8")
        content_parts.append(f"\n\n<!-- CHAPTER_START: {fname} -->\n<div class='chapter-page' id='chapter-{fname[:2]}'>\n\n" + raw + "\n\n</div>\n<!-- CHAPTER_END: {fname} -->\n\n")

merged_markdown = "\n".join(content_parts)
json_markdown = json.dumps(merged_markdown)

html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Velocity Cicada — Complete System & Testing Handbook</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Marked & Mermaid & KaTeX -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <style>
    :root {{
      --canvas: #f4f5ef;
      --surface: #ffffff;
      --forest: #104f2a;
      --forest-dark: #0a3a1e;
      --mint: #bff09c;
      --ink: #0b1210;
      --ink-muted: #5a6260;
      --border: rgba(11, 18, 16, 0.1);
    }}
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--canvas);
      color: var(--ink);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 80px;
    }}
    .container {{
      max-width: 1080px;
      margin: 0 auto;
      padding: 40px 24px;
    }}
    /* Cover Page */
    .cover {{
      background: linear-gradient(135deg, var(--forest-dark) 0%, var(--forest) 100%);
      color: #ffffff;
      padding: 80px 48px;
      border-radius: 28px;
      margin-bottom: 40px;
      box-shadow: 0 20px 40px rgba(10, 58, 30, 0.15);
      position: relative;
      overflow: hidden;
    }}
    .cover::after {{
      content: "";
      position: absolute;
      right: -100px;
      bottom: -100px;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, var(--mint) 0%, transparent 70%);
      opacity: 0.15;
      border-radius: 50%;
    }}
    .cover-chip {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(191, 240, 156, 0.2);
      border: 1px solid var(--mint);
      color: var(--mint);
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 24px;
    }}
    .cover h1 {{
      font-size: 48px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 16px;
    }}
    .cover p.subtitle {{
      font-size: 20px;
      color: rgba(255, 255, 255, 0.85);
      max-width: 720px;
      line-height: 1.4;
      margin-bottom: 32px;
    }}
    .cover-meta {{
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
    }}
    .cover-meta span strong {{
      color: #ffffff;
    }}

    /* Markdown Styling */
    .content {{
      background: var(--surface);
      border-radius: 24px;
      border: 1px solid var(--border);
      padding: 56px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    }}
    .chapter-page {{
      padding: 24px 0 48px 0;
      border-bottom: 2px dashed var(--border);
      margin-bottom: 48px;
    }}
    .chapter-page:last-child {{
      border-bottom: none;
    }}
    h1 {{
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--ink);
      margin-top: 36px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--mint);
    }}
    h2 {{
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--forest);
      margin-top: 32px;
      margin-bottom: 12px;
    }}
    h3 {{
      font-size: 18px;
      font-weight: 600;
      color: var(--ink);
      margin-top: 24px;
      margin-bottom: 8px;
    }}
    p {{
      margin-bottom: 16px;
      font-size: 15px;
      color: #2d3734;
      line-height: 1.65;
    }}
    ul, ol {{
      margin-left: 24px;
      margin-bottom: 16px;
      font-size: 15px;
      color: #2d3734;
    }}
    li {{
      margin-bottom: 6px;
    }}
    code {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      background: #f0f3eb;
      color: var(--forest-dark);
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid rgba(16, 79, 42, 0.1);
    }}
    pre {{
      background: #0b1210;
      color: #bff09c;
      padding: 20px;
      border-radius: 14px;
      overflow-x: auto;
      margin: 16px 0 24px 0;
      border: 1px solid rgba(0, 0, 0, 0.2);
    }}
    pre code {{
      background: transparent;
      color: inherit;
      padding: 0;
      border: none;
      font-size: 13px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0 28px 0;
      font-size: 14px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
    }}
    th {{
      background: #f0f3eb;
      color: var(--forest-dark);
      text-align: left;
      padding: 12px 16px;
      font-weight: 600;
      font-size: 13px;
      border-bottom: 1px solid var(--border);
    }}
    td {{
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      color: #2d3734;
      vertical-align: top;
    }}
    tr:nth-child(even) td {{
      background: #fafbf8;
    }}
    tr:hover td {{
      background: #f4f6f0;
    }}
    blockquote {{
      border-left: 4px solid var(--forest);
      background: #f4f6f0;
      padding: 16px 20px;
      border-radius: 0 12px 12px 0;
      margin: 16px 0;
      color: var(--forest-dark);
      font-style: italic;
    }}
    .mermaid {{
      background: #ffffff;
      padding: 24px;
      border-radius: 16px;
      border: 1px solid var(--border);
      margin: 24px 0;
      display: flex;
      justify-content: center;
    }}

    /* Print Styles */
    @media print {{
      body {{
        background: #ffffff;
        color: #000000;
        padding: 0;
      }}
      .container {{
        max-width: 100%;
        padding: 0;
      }}
      .content {{
        box-shadow: none;
        border: none;
        padding: 0;
      }}
      .chapter-page {{
        page-break-before: always;
        border-bottom: none;
      }}
      .cover {{
        page-break-after: always;
        border-radius: 0;
        box-shadow: none;
      }}
      a {{
        text-decoration: none;
        color: inherit;
      }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <!-- Cover Page -->
    <div class="cover">
      <div class="cover-chip">★ CICADA 2026 Master Handbook ★</div>
      <h1>Velocity Cicada</h1>
      <p class="subtitle">Complete Technical System Audit, Architectural Workflows, Manual Testing Guide & Hackathon Defense Manual</p>
      <div class="cover-meta">
        <span><strong>Architecture:</strong> Two-Tier Local/SaaS AIOps</span>
        <span><strong>Security:</strong> 0 Secrets Egress Guarantee</span>
        <span><strong>Reliability:</strong> Persistent Outbox & Idempotency</span>
        <span><strong>Engine:</strong> Welford Baselines & Multi-Signal Correlation</span>
      </div>
    </div>

    <!-- Main Content Container -->
    <div class="content" id="handbook-content">
      <p style="text-align: center; color: var(--ink-muted);">Rendering handbook chapters...</p>
    </div>
  </div>

  <script>
    mermaid.initialize({{ startOnLoad: false, theme: 'neutral' }});

    const rawMarkdown = {json_markdown};

    // Parse Markdown to HTML
    marked.setOptions({{
      gfm: true,
      breaks: false,
    }});
    const htmlContent = marked.parse(rawMarkdown);
    const container = document.getElementById('handbook-content');
    container.innerHTML = htmlContent;

    // Convert code blocks with class language-mermaid to mermaid divs
    const codeBlocks = container.querySelectorAll('pre code.language-mermaid');
    codeBlocks.forEach((block) => {{
      const pre = block.parentElement;
      const mermaidDiv = document.createElement('div');
      mermaidDiv.className = 'mermaid';
      mermaidDiv.textContent = block.textContent;
      pre.parentElement.replaceChild(mermaidDiv, pre);
    }});

    // Render Mermaid diagrams
    mermaid.run();
  </script>
</body>
</html>
"""

OUTPUT_HTML.write_text(html_template, encoding="utf-8")
print(f"Successfully generated master handbook HTML: {OUTPUT_HTML} ({len(html_template)} bytes)")
