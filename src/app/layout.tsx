import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black text-zinc-100 selection:bg-[#63d297]/30">
        {children}
      </body>
    </html>
  );
}
