import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mpexpenses.nz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "NZ Parliamentary Expenses | Transparency Dashboard",
  description:
    "Interactive visualization of New Zealand MP and Minister transport and accommodation spending from 2008 to 2025. Explore quarterly expense data by party, member, and category. Aotearoa's open data for government accountability.",
  keywords: [
    "New Zealand",
    "Aotearoa",
    "Parliament",
    "MP expenses",
    "Ministerial spending",
    "transparency",
    "accountability",
    "open data",
    "government spending",
  ],
  openGraph: {
    title: "NZ Parliamentary Expenses | Transparency Dashboard",
    description: "Explore New Zealand MP and Minister transport and accommodation spending from 2008 to 2025 in this interactive transparency dashboard.",
    url: siteUrl,
    siteName: "NZ Parliamentary Expenses Explorer",
    locale: "en_NZ",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "NZ Parliamentary Expenses — interactive transparency dashboard for New Zealand MP and Minister spending from 2008 to 2025.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NZ Parliamentary Expenses | Transparency Dashboard",
    description: "Explore New Zealand MP and Minister spending from 2008 to 2025 in this interactive dashboard.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
