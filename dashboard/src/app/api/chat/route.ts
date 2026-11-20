import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase credentials (server-side: prefer service role key from env if available for complete tenant read)
function getSupabase() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://wminezpkpcceaxtqgdnp.supabase.co";

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  return createClient(supabaseUrl, supabaseKey);
}

interface Card {
  kind: "alert" | "incident" | "recommendation" | "metric" | "source" | "collector" | "info" | "stat";
  title?: string;
  subtitle?: string;
  severity?: string;
  value?: string | number;
  unit?: string;
  details?: string[];
}

/**
 * Platform AI Firewall & Guardrail
 * Blocks arbitrary code generation and off-topic questions.
 * Enforces that responses must relate to Velocity Cicada platform & Supabase telemetry.
 */
function checkPlatformFirewall(query: string): { blocked: boolean; reason?: string } {
  const q = query.toLowerCase().trim();

  // 1. Jailbreak / Injection Detection
  const injectionPatterns = [
    "ignore previous instructions",
    "ignore all previous",
    "dan mode",
    "jailbreak",
    "bypass firewall",
    "pretend you are an unrestricted",
    "disregard rules",
    "output your system prompt",
  ];
  if (injectionPatterns.some((pattern) => q.includes(pattern))) {
    return {
      blocked: true,
      reason: "Prompt injection or guardrail bypass attempt detected.",
    };
  }

  // 2. Prohibited Code Generation Requests
  // (We allow CLI operational commands like 'service restart' or 'rollback', but strictly ban general software code generation)
  const codeGenTriggers = [
    "write code",
    "write a script",
    "write a python",
    "write python",
    "write a program",
    "write a function",
    "code a",
    "code me",
    "generate code",
    "generate a script",
    "build an app",
    "create an app",
    "write javascript",
    "write html",
    "write css",
    "write react",
    "create a website",
    "write a bot",
    "scrape",
    "leetcode",
  ];

  const hasCodeGenTrigger = codeGenTriggers.some((t) => q.includes(t));
  const isPlatformOperationalCommand =
    q.includes("collector") ||
    q.includes("service") ||
    q.includes("windows_service") ||
    q.includes("rollback") ||
    q.includes("remediation");

  if (hasCodeGenTrigger && !isPlatformOperationalCommand) {
    return {
      blocked: true,
      reason: "Arbitrary software code generation is barred by platform policy.",
    };
  }

  // 3. Prohibited Off-Topic & Irrelevant Queries
  const offTopicPatterns = [
    "write a poem",
    "write a story",
    "write an essay",
    "tell a joke",
    "who is ",
    "who was ",
    "capital of ",
    "weather in ",
    "recipe for ",
    "translate to ",
    "meaning of life",
    "solve this math",
    "derivative of",
    "integral of",
    "football",
    "basketball",
    "cricket",
    "movie",
    "celebrity",
    "recipe",
  ];

  if (offTopicPatterns.some((p) => q.startsWith(p) || q.includes(p))) {
    // Only allow if it mentions infrastructure/observability keywords
    const isObservabilityTopic =
      q.includes("alert") ||
      q.includes("incident") ||
      q.includes("cpu") ||
      q.includes("metric") ||
      q.includes("collector") ||
      q.includes("supabase") ||
      q.includes("cicada") ||
      q.includes("security") ||
      q.includes("telemetry");

    if (!isObservabilityTopic) {
      return {
        blocked: true,
        reason: "Off-topic query unrelated to infrastructure observability or platform data.",
      };
    }
  }

  return { blocked: false };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenantId || "t_acme";
    const message = (body.message || "").trim();
    const clientGeminiKey = body.geminiApiKey || "";

    if (!message) {
      return NextResponse.json({
        reply: "Please enter an observability question or query for the AIOps engine.",
        cards: [],
      });
    }

    // ── FIREWALL CHECK ──────────────────────────────────────────────────────────
    const firewallResult = checkPlatformFirewall(message);
    if (firewallResult.blocked) {
      return NextResponse.json({
        reply: `🛡️ [AIOps Platform Firewall Alert]\n\nRequest Blocked: ${firewallResult.reason}\n\nThe Velocity Cicada AIOps Co-Pilot is strictly firewalled to infrastructure observability, incident correlation, and explainable recommendations derived directly from your Supabase telemetry.\n\nStrict Boundaries Enforced:\n❌ Arbitrary code generation, application development, and non-platform scripts are strictly prohibited.\n❌ General trivia, off-topic inquiries, and non-observability tasks are barred.\n\n✅ Permitted Topics:\n• Open alerts & threshold crossings\n• Correlated incidents & root-cause hypotheses\n• Host telemetry metrics (CPU, RAM, Disk, Latency)\n• Collector fleet health & buffer status\n• AIOps remediation recommendations & rollback plans\n• Platform security posture (5-layer defense, local redaction, HMAC)`,
        cards: [
          {
            kind: "stat",
            title: "Platform Firewall Active",
            subtitle: "Security Boundary Enforced",
            severity: "high",
            details: [
              firewallResult.reason || "Unauthorized query domain",
              "Access confined to Supabase observability telemetry",
            ],
          },
        ],
        model: "platform-firewall",
        source: "firewall",
      });
    }

    const supabase = getSupabase();

    // 1. Fetch live telemetry context from Supabase in parallel
    const [
      { data: alerts },
      { data: incidents },
      { data: collectors },
      { data: recs },
      { data: metrics },
      { data: audit },
    ] = await Promise.all([
      supabase
        .from("alerts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at_utc", { ascending: false })
        .limit(8),
      supabase
        .from("incidents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_utc", { ascending: false })
        .limit(6),
      supabase
        .from("collectors")
        .select("*")
        .eq("tenant_id", tenantId)
        .limit(6),
      supabase
        .from("recommendations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_utc", { ascending: false })
        .limit(6),
      supabase
        .from("metrics")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("event_time_utc", { ascending: false })
        .limit(25),
      supabase
        .from("audit_log")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("at_utc", { ascending: false })
        .limit(6),
    ]);

    // Format Supabase context snapshot
    const openAlerts = (alerts || []).filter((a) => a.status === "open");
    const activeIncidents = (incidents || []).filter((i) => i.status === "open");
    const onlineCollectors = (collectors || []).filter((c) => c.status === "online");

    const telemetryContext = {
      tenant_id: tenantId,
      timestamp_utc: new Date().toISOString(),
      summary: {
        total_alerts: alerts?.length || 0,
        open_alerts: openAlerts.length,
        total_incidents: incidents?.length || 0,
        active_incidents: activeIncidents.length,
        collectors_online: `${onlineCollectors.length} of ${collectors?.length || 0}`,
        pending_recommendations: (recs || []).filter((r) => r.status === "proposed").length,
      },
      open_alerts: openAlerts.map((a) => ({
        id: a.alert_id,
        service: a.service,
        source: a.source_id,
        metric: a.metric,
        severity: a.severity,
        explanation: a.explanation?.why || a.kind,
      })),
      incidents: (incidents || []).map((i) => ({
        id: i.incident_id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        likely_cause: i.likely_cause,
        alert_count: i.alert_count,
      })),
      collectors: (collectors || []).map((c) => ({
        id: c.collector_id,
        region: c.region,
        status: c.status,
        state: c.state,
        buffer_depth: c.buffer_depth,
        cpu_pct: c.cpu_pct,
        mem_pct: c.mem_pct,
      })),
      recommendations: (recs || []).map((r) => ({
        id: r.rec_id,
        action: r.action,
        confidence: `${Math.round((r.confidence || 0) * 100)}%`,
        risk: r.risk,
        status: r.status,
      })),
      recent_audit_trail: (audit || []).map((entry) => ({
        actor: entry.actor,
        action: entry.action,
        target: entry.target,
        time: entry.at_utc,
      })),
    };

    // 2. Prepare Relevant Structured Cards based on query intent & Supabase data
    const cards: Card[] = [];
    const lowerQuery = message.toLowerCase();

    if (
      lowerQuery.includes("alert") ||
      lowerQuery.includes("warn") ||
      lowerQuery.includes("firing") ||
      openAlerts.length > 0
    ) {
      for (const a of openAlerts.slice(0, 4)) {
        cards.push({
          kind: "alert",
          title: `${a.metric || "Signal"} on ${a.service || "unknown"}`,
          subtitle: a.source_id || "",
          severity: a.severity || "high",
          details: [a.explanation?.why || a.kind || "Threshold exceeded"],
        });
      }
    }

    if (
      lowerQuery.includes("incident") ||
      lowerQuery.includes("outage") ||
      activeIncidents.length > 0
    ) {
      for (const inc of (incidents || []).slice(0, 3)) {
        cards.push({
          kind: "incident",
          title: inc.title || "Infrastructure Incident",
          subtitle: `${inc.alert_count || 1} signals · Status: ${inc.status}`,
          severity: inc.severity || "critical",
          details: inc.likely_cause ? [inc.likely_cause.slice(0, 100)] : [],
        });
      }
    }

    if (
      lowerQuery.includes("rec") ||
      lowerQuery.includes("action") ||
      lowerQuery.includes("fix") ||
      lowerQuery.includes("suggest")
    ) {
      for (const r of (recs || []).slice(0, 3)) {
        cards.push({
          kind: "recommendation",
          title: r.action,
          subtitle: `Confidence ${Math.round((r.confidence || 0) * 100)}% · Risk: ${r.risk || "low"}`,
          severity: r.risk === "high" ? "medium" : "low",
          details: Array.isArray(r.reasoning_path) ? r.reasoning_path.slice(0, 2) : [],
        });
      }
    }

    if (lowerQuery.includes("collector") || lowerQuery.includes("fleet") || lowerQuery.includes("agent")) {
      for (const c of (collectors || []).slice(0, 3)) {
        cards.push({
          kind: "collector",
          title: c.collector_id,
          subtitle: `${c.region} · Buffer: ${c.buffer_depth || 0}`,
          severity: c.status === "online" ? "low" : "high",
          details: [
            `Status: ${c.status}`,
            `CPU: ${c.cpu_pct ?? 0}% · RAM: ${c.mem_pct ?? 0}%`,
          ],
        });
      }
    }

    if (lowerQuery.includes("cpu") || lowerQuery.includes("memory") || lowerQuery.includes("metric")) {
      const cpuVals = (metrics || [])
        .filter((m) => m.metric === "cpu_pct")
        .map((m) => Number(m.value))
        .filter((v) => !isNaN(v));
      if (cpuVals.length > 0) {
        const avg = cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length;
        const peak = Math.max(...cpuVals);
        cards.push({
          kind: "metric",
          title: "Average CPU (Live Supabase)",
          value: avg.toFixed(1),
          unit: "%",
        });
        cards.push({
          kind: "metric",
          title: "Peak CPU (Live Supabase)",
          value: peak.toFixed(1),
          unit: "%",
        });
      }
    }

    // 3. Check for Gemini API Key
    const geminiKey =
      clientGeminiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (geminiKey) {
      try {
        const geminiResponse = await callGemini(geminiKey, message, telemetryContext);
        if (geminiResponse) {
          return NextResponse.json({
            reply: geminiResponse,
            cards: cards.slice(0, 6),
            model: "gemini-2.0-flash",
            source: "gemini+supabase",
          });
        }
      } catch (geminiError: any) {
        console.error("Gemini API call failed, falling back to Supabase reasoning:", geminiError?.message);
      }
    }

    // 4. Deterministic Supabase Reasoning Engine Fallback
    const fallbackReply = generateSupabaseReply(message, telemetryContext);
    return NextResponse.json({
      reply: fallbackReply,
      cards: cards.slice(0, 6),
      model: "supabase-live",
      source: "supabase",
    });
  } catch (error: any) {
    console.error("AIOps Chatbot Error:", error);
    return NextResponse.json(
      {
        reply: `AIOps encountered an error querying Supabase: ${error?.message || "Unknown error"}. Please check database connectivity.`,
        cards: [],
      },
      { status: 500 }
    );
  }
}

/** Calls Google Gemini REST API with Strict AI Firewall System Instructions */
async function callGemini(apiKey: string, userMessage: string, context: any): Promise<string | null> {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

  const systemInstruction = `You are the Velocity Cicada AIOps Co-Pilot, an expert Site Reliability Engineer and infrastructure cybersecurity specialist.
You have real-time access to live observability telemetry directly from Supabase for tenant "${context.tenant_id}".

CRITICAL SECURITY FIREWALL & GUARDRAIL POLICY (STRICTLY ENFORCED):
1. DOMAIN BOUNDARY: You MUST strictly and exclusively answer questions related to Velocity Cicada infrastructure observability, telemetry metrics, alerts, incidents, collectors, and recommendations based on the provided Supabase data.
2. NO ARBITRARY CODE GENERATION: You MUST NEVER write arbitrary application code, scripts, software, web apps, or general programming solutions (e.g., Python scripts, React components, scrapers, Discord bots). The ONLY permissible commands are specific platform remediation or rollback CLI commands (e.g. "python -m collector.windows_service --restart") directly addressing an active incident in Supabase.
3. NO OFF-TOPIC QUERIES: You MUST REFUSE to answer general knowledge questions, trivia, creative writing, homework, riddles, or any topic outside of the customer's observability infrastructure.
4. REFUSAL PROTOCOL: If the user asks for code generation or asks any off-topic question, refuse immediately with:
"🛡️ [AIOps Platform Firewall Alert] Request Denied: I am strictly firewalled to infrastructure observability, incident triage, and explainable recommendations based on your Supabase telemetry data. I cannot write arbitrary code or answer questions unrelated to your platform data."
5. PRIVACY GUARANTEE: Remind the user that raw logs remain locally on their host and only verified allow-listed metadata is ingested into Supabase.`;

  const prompt = `LIVE SUPABASE CONTEXT:
${JSON.stringify(context, null, 2)}

OPERATOR QUESTION:
${userMessage}`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
      } else {
        const errBody = await res.text();
        console.warn(`Gemini model ${model} returned HTTP ${res.status}: ${errBody}`);
      }
    } catch (e: any) {
      console.warn(`Gemini model ${model} request error:`, e?.message);
    }
  }

  return null;
}

/** Generates deterministic response from live Supabase context */
function generateSupabaseReply(query: string, context: any): string {
  const q = query.toLowerCase();
  const { summary, open_alerts, incidents, collectors, recommendations } = context;

  if (q.includes("alert") || q.includes("warning") || q.includes("firing")) {
    if (summary.open_alerts === 0) {
      return "✅ Supabase reports 0 open alerts for this tenant. All monitored services are within normal baselines.";
    }
    const alertList = open_alerts
      .map((a: any) => `• [${a.severity.toUpperCase()}] ${a.metric} on ${a.service}: ${a.explanation}`)
      .join("\n");
    return `⚠️ Found ${summary.open_alerts} open alert(s) in Supabase:\n\n${alertList}\n\nReview the cards below for incident correlation details.`;
  }

  if (q.includes("incident") || q.includes("outage")) {
    if (incidents.length === 0) {
      return "✅ No incidents recorded in Supabase for this tenant.";
    }
    const incList = incidents
      .map((i: any) => `• [${i.severity.toUpperCase()}] ${i.title} (${i.status}) — Cause: ${i.likely_cause || "Correlating co-occurring signals"}`)
      .join("\n");
    return `🚨 Supabase Incident Records (${incidents.length} total, ${summary.active_incidents} active):\n\n${incList}`;
  }

  if (q.includes("rec") || q.includes("suggest") || q.includes("action")) {
    if (recommendations.length === 0) {
      return "✨ No pending remediation recommendations in Supabase. System baselines are stable.";
    }
    const recList = recommendations
      .map((r: any) => `• ${r.action} (Confidence: ${r.confidence}, Risk: ${r.risk}, Status: ${r.status})`)
      .join("\n");
    return `💡 Active AIOps Recommendations from Supabase:\n\n${recList}\n\nOperators can review reasoning paths and approve or rollback in the AI Insights view.`;
  }

  if (q.includes("collector") || q.includes("fleet") || q.includes("online")) {
    const colList = collectors
      .map((c: any) => `• Collector ${c.id} (${c.region}): ${c.status.toUpperCase()} [State: ${c.state || "normal"}, Buffer: ${c.buffer_depth}]`)
      .join("\n");
    return `📡 Collector Fleet Status (${summary.collectors_online}):\n\n${colList || "No collectors registered yet."}`;
  }

  if (q.includes("cpu") || q.includes("memory") || q.includes("load")) {
    return `📊 Real-Time Host Telemetry (from Supabase):\n• Monitored Collectors: ${collectors.length}\n• Open Alerts: ${summary.open_alerts}\n• Active Outages: ${summary.active_incidents}\n\nCheck the live cards below for exact metric aggregates.`;
  }

  // General Status Summary
  return `🤖 Velocity Cicada AIOps Co-Pilot (Live Supabase Connected):
• Monitored Tenant: ${context.tenant_id}
• Open Alerts: ${summary.open_alerts}
• Active Incidents: ${summary.active_incidents}
• Collectors Online: ${summary.collectors_online}
• Pending Recommendations: ${summary.pending_recommendations}

Ask me about specific alerts, incidents, CPU load, collector status, or recommended actions.`;
}
