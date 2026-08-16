import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/components/auth-provider";
import { InstallPrompt } from "@/components/install-prompt";
import { ServiceWorkerRegistrar } from "@/components/sw-registrar";
import "./globals.css";

/**
 * Both are variable fonts, so one file per family covers every weight the app
 * uses — the old stylesheet asked Google for seven static Inter cuts and four of
 * Space Grotesk, of which 300, 800 and 900 were never used by anything.
 *
 * `display: swap` keeps text visible while the file arrives, and next/font emits
 * the fallback metric overrides that make that swap not move the page.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "RentOS — Property Management Platform",
  description: "Unified property management SaaS for apartments, Airbnb, single-family homes, and rooms for rent. Purpose-built for university cities and seasonal markets.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RentOS",
  },
};

export const viewport: Viewport = {
  // Brand cyan, matching .gradient-brand and manifest.json. Was violet, which
  // matched nothing in the interface.
  themeColor: "#0090B4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${spaceGrotesk.variable}`}
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Safari ignores the manifest and looks for this by convention. It is
            rendered at 180px, the size iOS actually wants, rather than pointing
            at the 192 and letting the phone downscale it. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          {children}
          <InstallPrompt />
          <ServiceWorkerRegistrar />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                color: "hsl(var(--card-foreground))",
                border: "1px solid hsl(var(--border))",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
