import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leads Hunters",
  description: "Captación de clientes para despachos de Segunda Oportunidad",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
