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
    default: "HireVerify | Background Verification Services",
    template: "%s | HireVerify by Brainhunt Ventures",
  },

  description:
    "HireVerify by Brainhunt Ventures provides background verification services for employers and screening teams, including employment, address, identity, education and other checks.",

  keywords: [
    "HireVerify",
    "Background Verification",
    "BGV Services India",
    "Candidate Background Verification",
    "Employee Screening",
    "Employment Verification",
    "Address Verification",
    "Identity Verification",
    "Education Verification",
    "Court Verification",
    "Credit Verification",
    "Reference Checks",
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
    title: "HireVerify | Background Verification Services",
    description:
      "Arrange candidate background checks with HireVerify by Brainhunt Ventures, including employment, address, identity, education, financial and court verification.",
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
    title: "HireVerify | Background Verification Services",
    description: "Background verification services for employers and screening teams.",
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

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://hireverify.brainhuntventures.com/#website",
  name: "HireVerify",
  url: "https://hireverify.brainhuntventures.com/",
  publisher: {
    "@id": "https://hireverify.brainhuntventures.com/#organization",
  },
  inLanguage: "en-IN",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
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