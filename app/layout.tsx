import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Inter, Cinzel, UnifrakturMaguntia } from "next/font/google";
import PwaInstallBanner from "./PwaInstallBanner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
});

const unifraktur = UnifrakturMaguntia({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-unifraktur",
});

export const metadata: Metadata = {
  title: "Friend of a Week - Royal Pairing System",
  description:
    "Connect with royalty every week through our magical pairing ceremony · 21-Day Faith Challenge",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FOW",
  },
  icons: {
    icon: [{ url: "/icons/favicon-96x96.png", sizes: "96x96", type: "image/png" }],
    apple: "/icons/web-app-manifest-192x192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "FOW",
    "msapplication-TileColor": "#0d0d10",
    "msapplication-TileImage": "/icons/web-app-manifest-192x192.png",
    "theme-color": "#0d0d10",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${cinzel.variable} ${unifraktur.variable} m-0 min-h-screen bg-[#0d0d10] font-sans text-white antialiased`}
      >
        {children}

        <Script id="pwa-init" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(function(reg) {
                  console.log('[FOW] SW ready');
                  if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                })
                .catch(function(err) {
                  console.warn('[FOW] SW failed:', err);
                });
            });
          }

          let deferredPrompt = null;

          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            deferredPrompt = e;

            if (localStorage.getItem('fow_install_dismissed')) return;

            setTimeout(function() {
              const banner = document.getElementById('fow-install-banner');
              if (banner) banner.style.display = 'flex';
            }, 4000);
          });

          window.fowInstall = function() {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(choice) {
              if (choice.outcome === 'accepted') {
                var el = document.getElementById('fow-install-banner');
                if (el) el.style.display = 'none';
              }
              deferredPrompt = null;
            });
          };

          window.fowDismissInstall = function() {
            var el = document.getElementById('fow-install-banner');
            if (el) el.style.display = 'none';
            localStorage.setItem('fow_install_dismissed', '1');
          };

          if (window.matchMedia('(display-mode: standalone)').matches) {
            localStorage.setItem('fow_install_dismissed', '1');
          }
        `}</Script>

        <PwaInstallBanner />
      </body>
    </html>
  );
}
