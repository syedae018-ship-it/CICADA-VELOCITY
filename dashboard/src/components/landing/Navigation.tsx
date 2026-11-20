"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Code2, Layers, Menu, X, ShieldCheck } from "lucide-react";

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-canvas/90 backdrop-blur-md border-b border-hairline py-3 shadow-card"
          : "bg-transparent py-4 border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shadow-cardMd transition-transform duration-200 group-hover:scale-105"
              style={{
                background:
                  "radial-gradient(130% 110% at 15% 10%, #176534 0%, #0a3a1e 70%, #062715 100%)",
              }}
            >
              <Layers className="w-4 h-4 text-brand-mint icon-sharp" />
            </div>
            <div>
              <div className="font-bold text-ink text-[16px] tracking-tight leading-none group-hover:text-brand-800 transition-colors">
                Velocity Cicada
              </div>
              <div className="text-[10px] text-ink-muted font-mono tracking-wider mt-0.5">
                TIER-1 PRIVACY / TIER-2 AIOPS
              </div>
            </div>
          </Link>
          <span className="hidden md:inline-flex ml-2 text-[10px] uppercase tracking-[0.16em] px-2.5 py-0.5 rounded-full bg-brand-chip text-brand-800 border border-[#d5e6b4] font-semibold">
            CICADA 2026
          </span>
        </div>

        {/* Desktop links */}
        <nav className="hidden lg:flex items-center gap-7 text-[13px] font-medium text-ink-soft">
          <a href="#boundary" className="hover:text-brand-700 transition-colors">
            Privacy Boundary
          </a>
          <a href="#architecture" className="hover:text-brand-700 transition-colors">
            Architecture
          </a>
          <a href="#security" className="hover:text-brand-700 transition-colors">
            Five Layers
          </a>
          <a href="#aiops" className="hover:text-brand-700 transition-colors">
            AIOps
          </a>
          <a href="#resilience" className="hover:text-brand-700 transition-colors">
            Network Resilience
          </a>
          <a href="#download" className="hover:text-brand-700 transition-colors">
            Windows Collector
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <a
            href="https://github.com/syedae018-ship-it/CICADA-VELOCITY"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-pill h-9 px-3.5 text-[13px]"
            title="View Source on GitHub"
          >
            <Code2 className="w-3.5 h-3.5 icon-sharp" />
            <span>GitHub</span>
          </a>
          <Link
            href="/dashboard"
            className="btn-pill-primary h-9 px-4 text-[13px] font-semibold"
          >
            <span>Live Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5 icon-sharp" />
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-canvas-deep transition-colors"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-canvas/98 border-b border-hairline px-6 py-5 space-y-4 shadow-cardLg">
          <nav className="flex flex-col space-y-3 text-[14px] font-medium text-ink-soft">
            <a
              href="#boundary"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-brand-700 transition-colors"
            >
              Privacy Boundary
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-brand-700 transition-colors"
            >
              Architecture
            </a>
            <a
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-brand-700 transition-colors"
            >
              Five Layers
            </a>
            <a
              href="#aiops"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-brand-700 transition-colors"
            >
              AIOps Engine
            </a>
            <a
              href="#resilience"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-brand-700 transition-colors"
            >
              Network Resilience
            </a>
            <a
              href="#download"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-brand-700 transition-colors"
            >
              Windows Collector
            </a>
          </nav>
          <div className="pt-4 border-t border-hairline flex flex-col gap-2.5">
            <Link
              href="/dashboard"
              className="btn-pill-primary justify-center text-[13px]"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>Live Dashboard</span>
              <ArrowRight className="w-4 h-4 icon-sharp" />
            </Link>
            <a
              href="https://github.com/syedae018-ship-it/CICADA-VELOCITY"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill justify-center text-[13px]"
            >
              <Code2 className="w-4 h-4 icon-sharp" />
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
