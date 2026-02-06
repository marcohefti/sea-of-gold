import type { Metadata } from "next";
import { Cinzel, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fontSans = Public_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontDisplay = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const fontMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Sea of Gold",
  description: "Single-player deterministic idle/incremental game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
