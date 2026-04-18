import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { LanguageProvider } from "@/components/providers/language-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WireGuard Manager",
  description: "Professional WireGuard VPN Management Interface",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "WireGuard Manager",
    description: "Professional WireGuard VPN Management Interface",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "WireGuard Manager" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WireGuard Manager",
    description: "Professional WireGuard VPN Management Interface",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${cairo.variable} font-sans min-h-screen antialiased`}>
        <SessionProvider>
          <ThemeProvider>
            <LanguageProvider>
              <TooltipProvider>
                {children}
                <Toaster position="top-right" richColors closeButton />
              </TooltipProvider>
            </LanguageProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
