import type { Metadata } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";

// Typography: Poppins for headings and key figures, Helvetica for body text, JetBrains Mono for data.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
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
    <html lang="en" className={`${poppins.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white font-sans">
        {children}
      </body>
    </html>
  );
}
