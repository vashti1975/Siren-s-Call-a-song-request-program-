import type { Metadata } from "next";
import "./globals.css";
import AppearanceProvider from "./appearance-provider";

export const metadata: Metadata = {
  title: "FFXIV Songbook",
  description: "A customizable song request program for Final Fantasy XIV bards.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><AppearanceProvider>{children}</AppearanceProvider></body>
    </html>
  );
}
