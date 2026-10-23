import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "../components/Navigation";
import ErrorBoundary from "../components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DOS USB - DOS Games Collection",
  description: "A modern UI for playing DOS games from a USB drive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables sit on <html> so Tailwind's root font stack can resolve them.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-gray-900 text-white">
        <ErrorBoundary>
          <div className="flex flex-col md:flex-row h-screen">
            <Navigation />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}
