import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, VT323 } from "next/font/google";
import "./globals.css";
import Navigation from "../components/Navigation";
import ErrorBoundary from "../components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  subsets: ["latin"],
  weight: "400",
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
    <html lang="en" className={`${geistSans.variable} ${bricolage.variable} ${vt323.variable}`}>
      <body className="bg-night text-paper antialiased">
        <ErrorBoundary>
          <div className="flex h-screen flex-col">
            <Navigation />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}
