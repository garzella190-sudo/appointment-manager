import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/hooks/useToast";
import BottomNav from "@/components/BottomNav";
import { Analytics } from "@vercel/analytics/next";
import SWRegister from "@/components/SWRegister";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agenda Appuntamenti",
  description: "Gestione appuntamenti premium",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Appointment Manager",
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
    <html lang="it" suppressHydrationWarning>
      <body className={`${inter.className} antialiased pb-32`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <main className="min-h-screen">
              {children}
            </main>
            <BottomNav />
            <Analytics />
            <SWRegister />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
