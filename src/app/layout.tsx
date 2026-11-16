import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TelegramProvider } from "@/components/layout/TelegramProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Игровой Хаб",
  description: "Мини-игры прямо в Telegram",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
