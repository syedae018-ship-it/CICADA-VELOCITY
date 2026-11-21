"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Maximize2,
  MessageCircle,
  Minimize2,
  RotateCcw,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { sendChatMessage, ChatTurn } from "@/lib/live";
import { TenantId } from "@/types";

interface Card {
  kind: "alert" | "incident" | "recommendation" | "metric" | "source" | "collector" | "info" | "stat";
  title?: string;
  subtitle?: string;
  severity?: string;
  value?: string | number;
  unit?: string;
  details?: string[];
}

interface Msg {
  role: "user" | "bot";
  text: string;
  cards?: Card[];
  model?: string;
}

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

const SUGGESTIONS = ["How's everything looking?", "Any open alerts?", "Are my collectors healthy?", "What should I fix first?"];

function greeting(tenantId: string): Msg {
  return {
    role: "bot",
    text: `Hi! I'm your Cicada assistant. I can see live telemetry for **${tenantId}**. Ask me anything about alerts, incidents, collectors or metrics.`,
  };
}

/** Minimal, safe markdown: **bold**, `code`, "- " / "• " / "* " bullets, paragraphs. No HTML injection. */
function renderInline(text: string, keyBase: string) {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${keyBase}-${i++}`}>{tok.slice(2, -2).replace(/`/g, "")}</strong>);
    else
      out.push(
        <code key={`${keyBase}-${i++}`} className="px-1 rounded bg-canvas-deep font-mono text-[12px]">
          {tok.slice(1, -1)}
        </code>
      );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: number) => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${k}`} className="list-disc pl-5 space-y-0.5">
          {bullets.map((b, j) => (
            <li key={j}>{renderInline(b, `li-${k}-${j}`)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };
  text.split("\n").forEach((raw, k) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flush(k);
    if (!line.trim()) return;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      <p key={`p-${k}`} className={heading ? "font-semibold" : undefined}>
        {renderInline(heading ? heading[1] : line, `p-${k}`)}
      </p>
    );
  });
  flush(-1);
  return <div className="space-y-2">{blocks}</div>;
}

function MiniCard({ card }: { card: Card }) {
  const Icon = CARD_ICONS[card.kind] || Bot;
  const tone =
    card.severity === "critical" || card.severity === "high"
      ? "text-danger-700 bg-danger-50"
      : card.severity === "medium"
        ? "text-warn-700 bg-warn-50"
        : "text-brand-800 bg-brand-chip";
  return (
    <div className="flex items-start gap-2 rounded-xl border border-hairline bg-surface p-2">
      <span className={`h-6 w-6 shrink-0 rounded-md flex items-center justify-center ${tone}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 text-[12px] leading-snug">
        <div className="font-semibold text-ink truncate">
          {card.title}
          {card.value !== undefined && (
            <span className="ml-1 font-mono">
              {card.value}
              {card.unit}
            </span>
          )}
        </div>
        {card.subtitle && <div className="text-ink-muted truncate">{card.subtitle}</div>}
      </div>
    </div>
  );
}

export default function ChatWidget({ tenantId }: { tenantId: TenantId }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [greeting(tenantId)]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // New tenant → new conversation (never leak one tenant's context into another's chat).
  useEffect(() => {
    setMessages([greeting(tenantId)]);
  }, [tenantId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    const history: ChatTurn[] = messages.slice(1).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setSending(true);
    try {
      const r = await sendChatMessage(tenantId, q, history);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: String(r.reply ?? "Sorry, I didn't get anything back."),
          cards: Array.isArray(r.cards)
            ? (r.cards as Card[])
                .filter((c, i, all) => all.findIndex((d) => d.title === c.title && d.subtitle === c.subtitle) === i)
                .slice(0, 4)
            : [],
          model: r.model ? String(r.model) : undefined,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "bot", text: `I couldn't reach the assistant just now (${(e as Error).message}). Try again in a moment.` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const lastModel = [...messages].reverse().find((m) => m.role === "bot" && m.model)?.model;
  const isGemini = !!lastModel && lastModel.startsWith("gemini");

  const panelSize = expanded
    ? "sm:w-[640px] sm:h-[min(820px,calc(100vh-7rem))]"
    : "sm:w-[400px] sm:h-[min(600px,calc(100vh-7rem))]";

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="AIOps assistant"
          className={`fixed z-50 inset-x-2 bottom-20 top-16 sm:inset-auto sm:right-6 sm:bottom-24 ${panelSize} flex flex-col rounded-[1.25rem] bg-surface border border-hairline shadow-cardLg overflow-hidden`}
        >
          <div className="flex items-center gap-2 px-4 py-3 bg-brand-800 text-white">
            <span className="h-8 w-8 rounded-full bg-brand-mint/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-brand-mint" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold leading-tight">Cicada Assistant</div>
              <div className="text-[11px] text-white/70 flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${isGemini || !lastModel ? "bg-brand-mint" : "bg-amber-300"}`} />
                {lastModel ? (isGemini ? `Gemini · live ${tenantId}` : `Offline mode · ${tenantId}`) : `Live · ${tenantId}`}
              </div>
            </div>
            <button
              onClick={() => setMessages([greeting(tenantId)])}
              title="New conversation"
              aria-label="New conversation"
              className="p-1.5 rounded-lg hover:bg-white/10"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Shrink" : "Expand"}
              aria-label={expanded ? "Shrink" : "Expand"}
              className="p-1.5 rounded-lg hover:bg-white/10 hidden sm:block"
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-canvas">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] space-y-2 ${m.role === "user" ? "items-end" : ""}`}>
                  <div
                    className={`px-3.5 py-2.5 text-[13.5px] leading-relaxed rounded-2xl ${
                      m.role === "user"
                        ? "bg-brand-700 text-white rounded-br-md whitespace-pre-wrap"
                        : "bg-surface text-ink border border-hairline rounded-bl-md"
                    }`}
                  >
                    {m.role === "user" ? m.text : <Markdown text={m.text} />}
                  </div>
                  {m.cards && m.cards.length > 0 && (
                    <div className="grid gap-1.5">
                      {m.cards.map((c, j) => (
                        <MiniCard key={j} card={c} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-surface border border-hairline flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-ink-muted animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            {messages.length === 1 && !sending && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-3 py-1.5 rounded-full text-[12px] bg-surface border border-hairline hover:border-brand-700 hover:text-brand-800 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 p-3 border-t border-hairline bg-surface"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Message the assistant…"
              className="flex-1 resize-none max-h-32 min-h-[40px] px-3.5 py-2.5 rounded-2xl bg-surface-soft border border-hairline focus:border-brand-700 focus:outline-none text-[13.5px]"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Send"
              className="h-10 w-10 shrink-0 rounded-full bg-brand-700 hover:bg-brand-600 text-white flex items-center justify-center disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open AIOps assistant"}
        className="fixed z-50 right-4 bottom-4 sm:right-6 sm:bottom-6 h-14 w-14 rounded-full bg-brand-800 hover:bg-brand-700 text-white shadow-hero flex items-center justify-center transition-transform hover:scale-105"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-brand-mint ring-2 ring-brand-800" />}
      </button>
    </>
  );
}
