import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/src/auth/AuthProvider";
import { ThemeProvider } from "@/src/lib/theme-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hireverify.brainhuntventures.com"),

  title: {
    default: "HireVerify | Background Verification Platform",
    template: "%s | HireVerify",
  },

  description:
    "HireVerify is a background verification platform that helps companies manage candidates, verification checks, documents, consent, and authorized client reports.",

  keywords: [
    "HireVerify",
    "Background Verification",
    "BGV Platform",
    "Candidate Verification",
    "Verification Checks",
    "Employment Verification",
    "Identity Verification",
    "Recruitment Software",
    "Hiring Platform",
    "Campus Recruitment",
    "Client Reports",
  ],

  authors: [
    {
      name: "HireVerify",
    },
  ],

  creator: "HireVerify",

  publisher: "HireVerify",

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "HireVerify | Background Verification Platform",
    description:
      "Manage background verification cases, checks, consent, documents, and secure client reports with HireVerify.",
    url: "https://hireverify.brainhuntventures.com",
    siteName: "HireVerify",
    locale: "en_US",
    type: "website",

    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "HireVerify",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "HireVerify | Background Verification Platform",
    description:
      "Background verification platform for companies and authorized clients.",
    images: ["/og-image.png"],
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}