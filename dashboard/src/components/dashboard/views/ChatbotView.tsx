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
        "Hi — I'm the AIOps co-pilot. Ask me about alerts, incidents, recommendations, metrics, or the security posture. Try a quick-action below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const send = async (text: string) => {
    const query = text.trim();
    if (!query || isSending) return;
    setMessages((m) => [...m, { role: "user", text: query, ts: Date.now() }]);
    setInput("");
    setIsSending(true);
    try {
      const resp = await sendChatMessage(tenantId, query);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: String(resp.reply ?? "I didn't find anything matching that."),
          cards: Array.isArray(resp.cards) ? (resp.cards as Card[]) : [],
          ts: Date.now(),
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: "I can't reach the AIOps engine right now. Try the sidebar views or re-run the query.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] gap-4">
      {/* Header */}
      <div
        className="card p-5 relative overflow-hidden text-white"
        style={{
          background:
            "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 55%, #062715 100%)",
        }}
      >
        <div className="ring-deco -right-8 -top-8 h-32 w-32" />
        <div className="relative flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-brand-mint text-brand-900 flex items-center justify-center shadow-cardMd">
            <Bot className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-brand-mint/90">
              AIOps Co-Pilot
            </div>
            <h1 className="text-[22px] font-bold tracking-tight leading-tight">
              Ask anything about your observability
            </h1>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 border border-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-mint animate-pulse" />
            Live · {tenantId}
          </span>
        </div>
      </div>

      {/* Chat scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto card p-5 space-y-4"
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
      <div className="card p-4">
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
            placeholder="Ask about alerts, incidents, CPU, baselines, audit log…"
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
  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-xl bg-brand-chip flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-brand-800" />
      </div>
      <div className="max-w-[88%] space-y-3">
        <div className="bg-surface-soft border border-hairline rounded-2xl rounded-tl-sm px-4 py-2.5 text-[14px] text-ink">
          {message.text}
        </div>
        {message.cards && message.cards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
    <div className="rounded-xl bg-white border border-hairline p-3">
      <div className="flex items-start gap-2">
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
