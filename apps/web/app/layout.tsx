import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Pacifico } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { publicPath } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-display" });
const pacifico = Pacifico({ weight: "400", subsets: ["latin"], variable: "--font-script" });

export const metadata: Metadata = {
  title: "Event Bazar — Discover what’s next",
  description: "CTFs, hackathons, programming contests and tech events in one community.",
  manifest: publicPath("/manifest.json"),
};

export const viewport: Viewport = { themeColor: "#a7e81b", colorScheme: "dark light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${manrope.variable} ${pacifico.variable}`}><Providers>{children}</Providers></body>
    </html>
  );
}
