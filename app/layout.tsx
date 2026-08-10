import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavLinks from "@/components/NavLinks";

// Yuvarlak/geometrik, "Google Sans" hissi veren bir sans-serif — NotebookLM'in
// dostane/modern görsel diline Geist'ten daha yakın.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TYT Çalışma Takip",
  description: "90 günlük TYT çalışma programı ve takip uygulaması",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
          <div className="mx-auto flex max-w-4xl items-center gap-8 px-4 py-4">
            <span className="text-base font-semibold tracking-tight">TYT Çalışma Takip</span>
            <NavLinks />
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
