import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NebulaBackground } from "@/components/nebula-background";
import { CosmicSceneDirector } from "@/components/cosmic-scene-director";
import { CommandDeck } from "@/components/command-deck";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pookie",
  description: "Everything a mother would be worried about and track — powered by AI.",
};

// viewport-fit=cover: iOS Safari safe-area insets (home indicator) are
// exposed via env() so the fixed Command Deck clears the home bar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved theme before first paint (no flash). Default: night forest. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("pookie-theme");if(t==="light"){document.documentElement.setAttribute("data-theme","light");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <NebulaBackground />
        <CosmicSceneDirector />
        <div aria-hidden="true" className="bridge-ambient" />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
        {/* Command Deck — mounted once at root. Never unmounts on route
            changes, never scrolls away. Hidden by design on entry pages. */}
        <CommandDeck />
      </body>
    </html>
  );
}
