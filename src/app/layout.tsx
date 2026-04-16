import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/hooks/useToast";
import BottomNav from "@/components/BottomNav";
import { Analytics } from "@vercel/analytics/next";
import SWRegister from "@/components/SWRegister";
import { createClient } from "@/utils/supabase/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agenda Guide Manu",
  description: "Gestione guide e appuntamenti",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agenda Guide Manu",
  },
};

export const viewport: Viewport = {
  themeColor: "#3B82F6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const userData = user ? {
    email: user.email,
    full_name: user.user_metadata?.full_name
  } : null;
  return (
    <html lang="it" className="h-full">
      <body className={`${inter.className} antialiased h-full overflow-hidden`}>
        <ToastProvider>
          <div className="flex flex-col h-full relative">
            <main className="flex-1 overflow-hidden relative pt-0">
              {children}
            </main>
            <BottomNav />
          </div>
          <Analytics />
          <SWRegister />
          <div id="datepicker-portal" />
        </ToastProvider>
      </body>
    </html>
  );
}

