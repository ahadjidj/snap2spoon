import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";
import FaroInit from "@/components/FaroInit";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "snap2spoon — turn Instagram videos into recipes",
  description:
    "Paste an Instagram cooking video. Get a clean, structured recipe in seconds. Save, rate, and share.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans min-h-screen">
        <FaroInit />
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-6xl px-5 pb-20">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
