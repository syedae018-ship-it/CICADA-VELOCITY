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
 * Soft pre-screening for non-platform code generation and off-topic requests.
 */
function checkPlatformFirewall(query: string): { blocked: boolean; isCodeGen?: boolean } {
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
    return { blocked: true, isCodeGen: false };
  }

  // 2. Prohibited General Code Generation Requests
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
    return { blocked: true, isCodeGen: true };
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
      return { blocked: true, isCodeGen: false };
    }
  }

  return { blocked: false };
}

function getNaturalFirewallRefusal(tenantId: string, isCodeGen: boolean): string {
  if (isCodeGen) {
    return `Hey! I can't write general application code or external software scripts — my role is dedicated specifically to monitoring, managing, and troubleshooting your Velocity Cicada infrastructure for tenant **${tenantId}**.\n\nEverything in your telemetry is currently live. Let me know if you want to inspect your open alerts, check host CPU/memory usage, or look at your collector health!`;
  }
  return `Hey there! I'm set up specifically to monitor and manage your Velocity Cicada infrastructure and live telemetry for tenant **${tenantId}**, so I stick to your platform data rather than general trivia.\n\nLet me know if there's anything about your servers, open alerts, or system metrics you'd like to check!`;
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

    const geminiKey =
      clientGeminiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    // ── FIREWALL CHECK (Used when Gemini is offline or for hard injections) ─────
    const firewallResult = checkPlatformFirewall(message);
    const isHardInjection =
      message.toLowerCase().includes("ignore previous") ||
      message.toLowerCase().includes("dan mode") ||
      message.toLowerCase().includes("output your system prompt");

    if (isHardInjection || (!geminiKey && firewallResult.blocked)) {
      return NextResponse.json({
        reply: getNaturalFirewallRefusal(tenantId, !!firewallResult.isCodeGen),
        cards: [
          {
            kind: "stat",
            title: `Tenant: ${tenantId}`,
            subtitle: "Observability Guardrail Active",
            severity: "low",
            details: [
              "Focus confined to Velocity Cicada telemetry",
              `Monitored Tenant: ${tenantId}`,
            ],
          },
        ],
        model: "platform-guardrail",
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

    // 3. Invoke Gemini if key is configured
    if (geminiKey) {
      try {
        const geminiResult = await callGemini(geminiKey, message, telemetryContext);
        if (geminiResult) {
          return NextResponse.json({
            reply: geminiResult.reply,
            cards: cards.slice(0, 6),
            model: geminiResult.model,
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

/** Calls Google Gemini REST API with Natural Conversational Instructions & Strict Boundaries */
async function callGemini(
  apiKey: string,
  userMessage: string,
  context: any
): Promise<{ reply: string; model: string } | null> {
  const models = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
  ];

  const systemInstruction = `You are the Velocity Cicada AIOps Assistant for tenant "${context.tenant_id}".

ROLE & CONVERSATIONAL STYLE:
- Talk naturally, warmly, intelligently, and conversationally, just like ChatGPT, Claude, or Gemini.
- Do NOT sound like a robot, an automated script, or a command-line dump.
- Speak in first person as a helpful, knowledgeable senior Site Reliability Engineer who knows tenant "${context.tenant_id}"'s infrastructure inside and out.
- Do NOT dump long bullet lists of zeros or disclaimers unless the user actually asks for a breakdown or status report.
- You have real-time visibility into the live Supabase observability telemetry for tenant "${context.tenant_id}". Always be aware of the tenant's current state (tenant ID, open alerts, active incidents, online collectors, metrics, and recommendations). Weave these details in smoothly and naturally.

DOMAIN BOUNDARIES & FIREWALL:
- Your purpose is Velocity Cicada infrastructure observability, telemetry analysis, incident triage, security posture, and system health for tenant "${context.tenant_id}".
- If the user asks you to write non-platform application code (e.g. building games, web scrapers, unrelated Python/JS apps, Discord bots) or asks off-topic general knowledge (e.g. movies, celebrities, sports, recipes, history):
  Politely and conversationally decline in a natural human voice. Explain that you are dedicated specifically to monitoring and securing tenant "${context.tenant_id}"'s infrastructure, and offer to help them check their alerts, system telemetry, or collector health instead.
- Never output rigid robot warning headers, error codes, or policy banners. Speak naturally and politely.
- PRIVACY: Raw logs remain locally on the customer's host; only sanitized, allow-listed metadata is in Supabase.`;

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
            temperature: 0.7,
            maxOutputTokens: 800,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { reply: text.trim(), model };
        }
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
  const q = query.toLowerCase().trim();
  const { summary, open_alerts, incidents, collectors, recommendations } = context;

  // Conversational greetings
  if (
    q === "hi" ||
    q === "hii" ||
    q === "hiii" ||
    q === "hello" ||
    q === "hey" ||
    q === "hey there" ||
    q.startsWith("hi ") ||
    q.startsWith("hello ") ||
    q.startsWith("hey ")
  ) {
    return `Hey there! Good to see you.

I'm keeping an eye on tenant **${context.tenant_id}** for you. Right now, things are looking smooth:
• **Open Alerts:** ${summary.open_alerts}
• **Active Incidents:** ${summary.active_incidents}
• **Collectors Online:** ${summary.collectors_online}

How's everything going on your end? Feel free to ask about your server metrics, open alerts, or collector health!`;
  }

  if (q.includes("alert") || q.includes("warning") || q.includes("firing")) {
    if (summary.open_alerts === 0) {
      return `Good news — all quiet on tenant **${context.tenant_id}**. Supabase reports 0 open alerts right now, and all monitored services are within their expected baselines.`;
    }
    const alertList = open_alerts
      .map((a: any) => `• [${a.severity.toUpperCase()}] ${a.metric} on ${a.service}: ${a.explanation}`)
      .join("\n");
    return `Looks like we have ${summary.open_alerts} open alert(s) on tenant **${context.tenant_id}**:\n\n${alertList}\n\nCheck out the alert cards below for details on each signal.`;
  }

  if (q.includes("incident") || q.includes("outage")) {
    if (incidents.length === 0) {
      return `No active or past incidents recorded in Supabase for tenant **${context.tenant_id}**. Everything is operating smoothly.`;
    }
    const incList = incidents
      .map((i: any) => `• [${i.severity.toUpperCase()}] ${i.title} (${i.status}) — Likely cause: ${i.likely_cause || "Correlating co-occurring signals"}`)
      .join("\n");
    return `Here is what I found in the incident log for tenant **${context.tenant_id}** (${incidents.length} total, ${summary.active_incidents} active):\n\n${incList}`;
  }

  if (q.includes("rec") || q.includes("suggest") || q.includes("action")) {
    if (recommendations.length === 0) {
      return `No pending recommendations right now for tenant **${context.tenant_id}** — system baselines are healthy and running as expected.`;
    }
    const recList = recommendations
      .map((r: any) => `• ${r.action} (Confidence: ${r.confidence}, Risk: ${r.risk}, Status: ${r.status})`)
      .join("\n");
    return `Here are the active AIOps recommendations proposed for tenant **${context.tenant_id}**:\n\n${recList}\n\nYou can review reasoning paths and approve or roll back directly in AI Insights.`;
  }

  if (q.includes("collector") || q.includes("fleet") || q.includes("online")) {
    const colList = collectors
      .map((c: any) => `• Collector ${c.id} (${c.region}): ${c.status.toUpperCase()} [Buffer: ${c.buffer_depth || 0}, State: ${c.state || "normal"}]`)
      .join("\n");
    return `Here's the collector fleet status for tenant **${context.tenant_id}** (${summary.collectors_online}):\n\n${colList || "No collectors registered yet."}`;
  }

  if (q.includes("cpu") || q.includes("memory") || q.includes("load")) {
    return `Here is the current resource picture for tenant **${context.tenant_id}**:\n• Monitored Collectors: ${collectors.length}\n• Open Alerts: ${summary.open_alerts}\n• Active Outages: ${summary.active_incidents}\n\nCheck the live cards below for exact metric aggregates and recent peaks.`;
  }

  // General Status Summary
  return `I'm here to help you monitor tenant **${context.tenant_id}**! Right now, you have:
• **Open Alerts:** ${summary.open_alerts}
• **Active Incidents:** ${summary.active_incidents}
• **Collectors Online:** ${summary.collectors_online}
• **Pending Recommendations:** ${summary.pending_recommendations}

Ask me about your alerts, CPU load, collector health, or incident recommendations and I'll pull the live details.`;
  return `🤖 Velocity Cicada AIOps Co-Pilot (Live Supabase Connected):
• Monitored Tenant: ${context.tenant_id}
• Open Alerts: ${summary.open_alerts}
• Active Incidents: ${summary.active_incidents}
• Collectors Online: ${summary.collectors_online}
• Pending Recommendations: ${summary.pending_recommendations}

Ask me about specific alerts, incidents, CPU load, collector status, or recommended actions.`;
}
