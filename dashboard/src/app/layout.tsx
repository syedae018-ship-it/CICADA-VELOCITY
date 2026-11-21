import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Inter: a geometric sans used across the whole product (body + headings + key figures).
// JetBrains Mono: for data such as IDs, hashes and raw payloads.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});
// Space Grotesk: display face used on the landing page hero and large headings.
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Velocity Cicada · Secure AIOps Observability",
  description:
    "Two-tier, privacy-first AIOps observability: raw telemetry stays in the customer environment, only allow-listed metadata reaches the SaaS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${grotesk.variable}`}>
      <body className="min-h-screen bg-canvas text-ink antialiased selection:bg-brand-600 selection:text-white font-sans">
        {children}
      </body>
    </html>
  );
}
