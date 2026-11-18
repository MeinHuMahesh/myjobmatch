import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobMatch — IITB Placement Favourability",
  description:
    "Daily-refreshed IIT Bombay placement postings, scored against your resume with an explainable favourability rating.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070b14",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let content = children;
  if (process.env.PAGES_EXPORT === "1") {
    const { ResumeProvider } = await import("@/components/ResumeProvider");
    content = <ResumeProvider>{children}</ResumeProvider>;
  }

  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b14]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/20 text-sm font-bold text-indigo-300">
                JM
              </span>
              <span className="text-sm font-semibold tracking-wide text-slate-100">
                JobMatch
              </span>
            </Link>
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/resume"
                className="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                Resume
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-6 pt-6 sm:pb-8 sm:pt-8">{content}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-24 pt-4 text-xs text-slate-500 sm:pb-10">
          Data is scraped from the public IIT Bombay placement portal and scored locally. No
          credentials are stored.
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
