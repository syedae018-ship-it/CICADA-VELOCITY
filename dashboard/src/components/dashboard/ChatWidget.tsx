"use client";

import React, { useEffect, useRef, useState } from "react";
import { Maximize2, MessageCircle, Minimize2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { streamChatMessage, ChatTurn } from "@/lib/live";
import { TenantId } from "@/types";

interface Msg {
  role: "user" | "bot";
  text: string;
  model?: string;
}

const SUGGESTIONS = [
  "How's everything running?",
  "What's the Prometheus feed showing?",
  "Explain the ingest firewall",
  "What should I fix first?",
];

function greeting(tenantId: string): Msg {
  return {
    role: "bot",
    text: `Hey! I'm Cicada, your assistant for **${tenantId}**. I can see your live telemetry, so ask me anything — how things are running, why something broke, or what to do next.`,
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

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    const history: ChatTurn[] = messages.slice(1).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text: q }, { role: "bot", text: "" }]);
    setInput("");
    setSending(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const setLast = (patch: Partial<Msg>) =>
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
        return copy;
      });
    try {
      const { text: full, model } = await streamChatMessage(tenantId, q, history, (t) => setLast({ text: t }), ctrl.signal);
      setLast({ text: full || "Sorry, I didn't get a reply back. Mind trying again?", model });
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setLast({ text: `I couldn't reach the assistant just now (${(e as Error).message}). Try again in a moment.` });
    } finally {
      setSending(false);
      abortRef.current = null;
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
                {lastModel ? (isGemini ? `${lastModel} · live ${tenantId}` : `Offline mode · ${tenantId}`) : `Gemini · live ${tenantId}`}
              </div>
            </div>
            <button
              onClick={() => {
                abortRef.current?.abort();
                setMessages([greeting(tenantId)]);
              }}
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
            {messages.map((m, i) =>
              m.role === "bot" && !m.text ? null : (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 text-[13.5px] leading-relaxed rounded-2xl ${
                      m.role === "user"
                        ? "bg-brand-700 text-white rounded-br-md whitespace-pre-wrap"
                        : "bg-surface text-ink border border-hairline rounded-bl-md"
                    }`}
                  >
                    {m.role === "user" ? m.text : <Markdown text={m.text} />}
                  </div>
                </div>
              )
            )}
            {sending && !messages[messages.length - 1]?.text && (
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
