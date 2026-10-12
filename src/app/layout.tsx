import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NebulaBackground } from "@/components/nebula-background";
import { CosmicSceneDirector } from "@/components/cosmic-scene-director";
import { CommandDeck } from "@/components/command-deck";
import { ServiceWorkerRegistrar } from "@/components/pwa/sw-registrar";

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
  description:
    "Your whole life, flown from one cockpit — time, tasks, school, family, health, money, with a divine AI co-pilot.",
  // Squad Mobile 2026-10-12 — PWA installability (iOS + Android).
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pookie",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// viewport-fit=cover: iOS Safari safe-area insets (home indicator) are
// exposed via env() so the fixed Command Deck clears the home bar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Squad Mobile 2026-10-12 — status bar / browser chrome matches the cosmos.
  themeColor: "#050510",
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
        {/* Squad Mobile 2026-10-12 — iOS splash screens for Add to Home Screen.
            Next.js metadata has no startup-image API, so these are manual. */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-640x1136.png"
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-750x1334.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-828x1792.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-1125x2436.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-1170x2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-1242x2688.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-1284x2778.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/splash-2048x2732.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistrar />
        <NebulaBackground />
        <CosmicSceneDirector />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
        {/* Command Deck — mounted once at root. Never unmounts on route
            changes, never scrolls away. Hidden by design on entry pages. */}
        <CommandDeck />
      </body>
    </html>
  );
}
