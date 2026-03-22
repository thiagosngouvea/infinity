import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClanProvider } from "@/contexts/ClanContext";
import { Toaster } from "react-hot-toast";

// Metadata base — o título real é sobrescrito dinamicamente pelo ClanContext
export const metadata: Metadata = {
  title: "Sistema de Gerenciamento de Clã",
  description: "Plataforma white-label para gerenciamento de clãs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <ClanProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" />
          </AuthProvider>
        </ClanProvider>
      </body>
    </html>
  );
}
