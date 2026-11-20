"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Zap,
  AlertTriangle,
  Activity,
  Shield,
  ShieldCheck,
  Server,
  FileCheck2,
  Cpu,
  TrendingUp,
  Key,
  CheckCircle2,
  X,
  ExternalLink,
} from "lucide-react";
import { sendChatMessage } from "@/lib/live";
import { TenantId } from "@/types";

interface ChatbotViewProps {
  tenantId: TenantId;
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

interface ChatMessage {
  role: "user" | "bot";
  text: string;
  cards?: Card[];
  model?: string;
  source?: string;
  ts: number;
}

const QUICK_ACTIONS = [
  { label: "Show open alerts", icon: AlertTriangle },
  { label: "Recent incidents", icon: Zap },
  { label: "Any recommendations?", icon: Sparkles },
  { label: "CPU status", icon: Cpu },
  { label: "Health summary", icon: Activity },
  { label: "Collectors online?", icon: Server },
  { label: "Secrets caught today", icon: Shield },
  { label: "Who approved last?", icon: FileCheck2 },
];

const CARD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  alert: AlertTriangle,
  incident: Zap,
  recommendation: Sparkles,
  metric: TrendingUp,
  source: Server,
  collector: ShieldCheck,
  info: Bot,
  stat: Activity,
};

export default function ChatbotView({ tenantId }: ChatbotViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      ts: Date.now(),
      text:
        "Hi — I'm your AIOps co-pilot, connected in real-time to your Supabase observability database and enhanced by Google Gemini. Ask me about alerts, incidents, telemetry metrics, or root-cause recommendations.",
      model: "supabase-live",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load saved Gemini API key from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("velocity_cicada_gemini_key") || "";
      if (saved) {
        setGeminiKey(saved);
        setKeyInput(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const saveGeminiKey = (key: string) => {
    const trimmed = key.trim();
    setGeminiKey(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem("velocity_cicada_gemini_key", trimmed);
      } else {
        localStorage.removeItem("velocity_cicada_gemini_key");
      }
    } catch {}
    setShowKeyModal(false);
  };

  const send = async (text: string) => {
    const query = text.trim();
    if (!query || isSending) return;
    setMessages((m) => [...m, { role: "user", text: query, ts: Date.now() }]);
    setInput("");
    setIsSending(true);
    try {
      const resp = await sendChatMessage(tenantId, query, "", geminiKey || undefined);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: String(resp.reply ?? "I didn't find any records matching that in Supabase."),
          cards: Array.isArray(resp.cards) ? (resp.cards as Card[]) : [],
          model: resp.model ? String(resp.model) : undefined,
          source: resp.source ? String(resp.source) : undefined,
          ts: Date.now(),
        },
      ]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: "I encountered an error querying the AIOps engine: " + (err?.message || "Connection failed") + ". Please ensure your database or local network connection is active.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[520px] gap-4">
      {/* Header Banner */}
      <div
        className="card p-5 relative overflow-hidden text-white shadow-hero"
        style={{
          background:
            "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 55%, #062715 100%)",
        }}
      >
        <div className="ring-deco -right-8 -top-8 h-32 w-32" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-brand-mint text-brand-900 flex items-center justify-center shadow-cardMd shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.2em] text-brand-mint/90 font-mono font-bold">
                  AIOps Co-Pilot
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-brand-mint border border-white/15">
                  Supabase Live
                </span>
              </div>
              <h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight leading-tight mt-0.5">
                Real-Time Infrastructure Intelligence
              </h1>
            </div>
          </div>

          {/* Active AI Provider Status & Gemini Setup */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                geminiKey
                  ? "bg-brand-mint text-brand-950 font-bold shadow-sm hover:brightness-105"
                  : "bg-white/10 text-white border border-white/25 hover:bg-white/20"
              }`}
              title="Configure Google Gemini API Key"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{geminiKey ? "Gemini Active" : "Connect Gemini API"}</span>
            </button>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-mono font-semibold bg-black/30 border border-white/10 text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-mint animate-pulse" />
              Tenant: {tenantId}
            </span>
          </div>
        </div>
      </div>

      {/* Chat scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto card p-5 space-y-4 bg-surface"
      >
        {messages.map((m, i) => (
          <MessageBubble key={m.ts + "-" + i} message={m} />
        ))}
        {isSending && (
          <div className="flex items-center gap-2 text-ink-muted text-[13px]">
            <div className="h-7 w-7 rounded-xl bg-brand-chip flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-brand-800" />
            </div>
            <span className="flex gap-1">
              <Dot delay={0} /> <Dot delay={150} /> <Dot delay={300} />
            </span>
          </div>
        )}
      </div>

      {/* Quick actions + input */}
      <div className="card p-4 bg-surface">
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => send(label)}
              disabled={isSending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-soft border border-hairline hover:border-brand-700 hover:text-brand-800 transition-colors disabled:opacity-50"
            >
              <Icon className="w-3.5 h-3.5 icon-sharp" />
              {label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 items-center"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about alerts, incidents, CPU load, recommendations, collectors, or security..."
            className="flex-1 h-12 px-4 rounded-full bg-surface-soft border border-hairline focus:border-brand-700 focus:outline-none text-[14px]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="btn-pill-primary h-12 px-5 inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4 icon-sharp" /> Send
          </button>
        </form>
      </div>

      {/* Gemini API Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 bg-surface shadow-cardLg border border-hairline space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-brand-chip flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-brand-800" />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-[16px]">Google Gemini API</h3>
                  <div className="text-[11px] text-ink-muted">AIOps Generative Reasoning</div>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-lg hover:bg-canvas-deep text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13px] text-ink-soft leading-relaxed">
              Connect your Google Gemini API key to enable natural-language conversational reasoning over your live Supabase telemetry.
            </p>

            <div className="space-y-1.5">
              <label className="text-[12px] font-mono font-bold text-ink flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-brand-700" />
                Gemini API Key:
              </label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full h-10 px-3 rounded-lg bg-surface-soft border border-hairline focus:border-brand-700 focus:outline-none font-mono text-[13px]"
              />
              <div className="text-[11px] text-ink-muted">
                Key is stored locally in your browser and used securely to query Gemini.
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-brand-700 hover:underline flex items-center gap-1"
              >
                <span>Get a free key from Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
              {geminiKey && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyInput("");
                    saveGeminiKey("");
                  }}
                  className="px-3 py-1.5 rounded-lg text-[13px] text-danger-700 hover:bg-danger-50 transition-colors"
                >
                  Clear Key
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-1.5 rounded-lg text-[13px] text-ink-soft hover:bg-canvas-deep transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveGeminiKey(keyInput)}
                className="btn-pill-primary px-4 py-1.5 text-[13px]"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[80%] bg-brand-700 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-[14px] shadow-card">
          {message.text}
        </div>
        <div className="h-7 w-7 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-ink-soft icon-sharp" />
        </div>
      </div>
    );
  }

  const isGemini = message.model?.includes("gemini") || message.source?.includes("gemini");

  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-xl bg-brand-chip flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-brand-800" />
      </div>
      <div className="max-w-[88%] space-y-2.5">
        <div className="flex items-center gap-2">
          {isGemini ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-chip text-brand-800 font-semibold border border-[#d5e6b4]">
              <Sparkles className="w-3 h-3 text-brand-700" />
              {message.model ? message.model.replace("models/", "") : "Gemini 3.5 Flash"} + Supabase
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-canvas-deep text-ink-soft border border-hairline font-semibold">
              <Activity className="w-3 h-3 text-brand-700" />
              Supabase Live Engine
            </span>
          )}
        </div>
        <div className="bg-surface-soft border border-hairline rounded-2xl rounded-tl-sm px-4 py-3 text-[14px] text-ink leading-relaxed whitespace-pre-wrap">
          {message.text}
        </div>
        {message.cards && message.cards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {message.cards.slice(0, 6).map((c, i) => (
              <DataCard key={i} card={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DataCard({ card }: { card: Card }) {
  const Icon = CARD_ICONS[card.kind] ?? Bot;
  const severityColor =
    card.severity === "critical"
      ? "bg-danger-50 text-danger-700 border-[#f5c6bd]"
      : card.severity === "high"
      ? "bg-warn-50 text-warn-700 border-[#f3dca6]"
      : card.severity === "medium"
      ? "bg-warn-50 text-warn-700 border-[#f3dca6]"
      : "bg-brand-chip text-brand-800 border-[#d5e6b4]";
  return (
    <div className="rounded-xl bg-surface border border-hairline p-3 shadow-card hover:border-hairline-strong transition-colors">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-brand-chip flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-brand-800 icon-sharp" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[13px] font-semibold text-ink truncate">
              {card.title ?? card.kind}
            </div>
            {card.severity && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${severityColor}`}
              >
                {card.severity}
              </span>
            )}
          </div>
          {card.subtitle && (
            <div className="text-[12px] text-ink-muted truncate">{card.subtitle}</div>
          )}
          {card.value !== undefined && (
            <div className="mt-1 text-[16px] font-mono font-bold text-brand-800">
              {card.value}
              {card.unit && <span className="text-[11px] ml-0.5 text-ink-muted font-normal">{card.unit}</span>}
            </div>
          )}
          {card.details && card.details.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {card.details.slice(0, 3).map((d, i) => (
                <li key={i} className="text-[11px] text-ink-soft">
                  · {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-brand-700 inline-block"
      style={{ animation: `bounce 1s ${delay}ms infinite` }}
    />
  );
}
