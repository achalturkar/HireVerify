import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/src/auth/AuthProvider";
import { ThemeProvider } from "@/src/lib/theme-context";
import { PlatformBrandingProvider } from "@/src/components/providers/PlatformBrandingProvider";

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
    default: "HireVerify | BGV Platform by Brainhunt Ventures",
    template: "%s | HireVerify by Brainhunt Ventures",
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

  authors: [{ name: "Brainhunt Ventures" }],

  creator: "Brainhunt Ventures",

  publisher: "Brainhunt Ventures",

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

  openGraph: {
    title: "HireVerify | BGV Platform by Brainhunt Ventures",
    description:
      "Manage candidate background verification, checks, consent, documents, and client reports with HireVerify by Brainhunt Ventures.",
    url: "https://hireverify.brainhuntventures.com",
    siteName: "HireVerify by Brainhunt Ventures",
    locale: "en_IN",
    type: "website",

    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "HireVerify",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "HireVerify | BGV Platform by Brainhunt Ventures",
    description: "Background verification platform for companies and authorized clients.",
    images: ["/opengraph-image"],
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

const organizationStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://hireverify.brainhuntventures.com/#organization",
  name: "Brainhunt Ventures",
  alternateName: "HireVerify",
  url: "https://hireverify.brainhuntventures.com/",
  brand: {
    "@type": "Brand",
    name: "HireVerify",
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: "Plot No.3, 2nd Floor, Indraprastha Apartment, Dronacharya Nagar, Trimurti Nagar",
    addressLocality: "Nagpur",
    postalCode: "440022",
    addressCountry: "IN",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+91 96890 03720",
      email: "contact@brainhuntventures.com",
      contactType: "sales",
      areaServed: "IN",
      availableLanguage: "English",
    },
    {
      "@type": "ContactPoint",
      telephone: "+91 83903 24344",
      email: "suhas@brainhuntventures.com",
      contactType: "technical support",
      areaServed: "IN",
      availableLanguage: "English",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationStructuredData) }}
        />
        <PlatformBrandingProvider>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </PlatformBrandingProvider>
      </body>
    </html>
  );
}