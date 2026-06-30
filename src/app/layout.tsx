import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tunjuk — AI that watches your screen",
  description:
    "AI screen tutor running on Chutes confidential compute. Sign in with your Chutes account, share a window, ask anything.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#08090f] text-zinc-100 selection:bg-cyan-400/30">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_30%_-10%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(99,102,241,0.10),transparent_50%)]" />
        {children}
      </body>
    </html>
  );
}
