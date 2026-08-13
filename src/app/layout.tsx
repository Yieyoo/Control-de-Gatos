import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navigation/Navbar";
import { BottomNav } from "@/components/Navigation/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Control de Gastos",
  description: "Aplicación para controlar ingresos, gastos y ahorros personales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 pb-24 md:pb-8">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
