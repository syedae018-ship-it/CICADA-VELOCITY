"use client";

import React from "react";
import { Navigation } from "@/components/landing/Navigation";
import { HeroPrivacyBoundary } from "@/components/landing/HeroPrivacyBoundary";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { ArchitecturePipeline } from "@/components/landing/ArchitecturePipeline";
import { PrivacyComparison } from "@/components/landing/PrivacyComparison";
import { SecurityLayers } from "@/components/landing/SecurityLayers";
import { AIOpsIntelligence } from "@/components/landing/AIOpsIntelligence";
import { NetworkResilience } from "@/components/landing/NetworkResilience";
import { WindowsCollectorShowcase } from "@/components/landing/WindowsCollectorShowcase";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-brand-700 selection:text-white flex flex-col">
      {/* 08. Refined Sticky Navigation Header */}
      <Navigation />

      {/* Main Narrative Flow */}
      <main className="flex-1">
        {/* SECTION A: Hero & The Privacy Boundary Signature Visual */}
        <HeroPrivacyBoundary />

        {/* SECTION B: Verified Proof Strip */}
        <ProofStrip />

        {/* SECTION C: The Architecture Pipeline */}
        <ArchitecturePipeline />

        {/* SECTION D: The Privacy Boundary (Raw vs Transmitted Comparison) */}
        <PrivacyComparison />

        {/* SECTION E: Five Security Layers (Vertical Architecture Stack) */}
        <SecurityLayers />

        {/* SECTION F: AIOps Intelligence (Signal-to-Incident Demonstration) */}
        <AIOpsIntelligence />

        {/* SECTION G: Network Resilience (Outage & Replay Safety) */}
        <NetworkResilience />

        {/* SECTION H: Windows Local Collector Product Showcase */}
        <WindowsCollectorShowcase />

        {/* SECTION I: Memorable Final Call to Action */}
        <FinalCta />
      </main>

      {/* SECTION J: Architectural Footer */}
      <Footer />
    </div>
  );
}
