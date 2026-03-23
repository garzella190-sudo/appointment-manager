import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/hooks/useToast";
import BottomNav from "@/components/BottomNav";
import { Analytics } from "@vercel/analytics/next";
import SWRegister from "@/components/SWRegister";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agenda Guide",
  description: "Gestione guide e appuntamenti",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agenda Guide",
  },
};

export const viewport: Viewport = {
  themeColor: "#3B82F6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${inter.className} antialiased pb-32`}>
        <ToastProvider>
          <main className="min-h-screen">
            {children}
          </main>
          <BottomNav />
          <Analytics />
          <SWRegister />
        </ToastProvider>
      </body>
    </html>
  );
}

