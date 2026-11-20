import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Login | Velocity Cicada",
  description: "Secure, modern authentication portal powered by Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
