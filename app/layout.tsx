import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClanProvider } from "@/contexts/ClanContext";
import { Toaster } from "react-hot-toast";
import LiveRaffleListener from "@/components/LiveRaffleListener";

// Metadata base — o título real é sobrescrito dinamicamente pelo ClanContext
export const metadata: Metadata = {
  title: "Sistema de Gerenciamento de Clã",
  description: "Plataforma para gerenciamento de clãs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ClanProvider>
          <AuthProvider>
            {children}
            <LiveRaffleListener />
            <Toaster position="top-right" />
          </AuthProvider>
        </ClanProvider>
      </body>
    </html>
  );
}
