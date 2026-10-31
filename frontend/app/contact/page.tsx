import type { Metadata } from "next";
import ContactClient from "@/src/components/layout/contactClient";

export const metadata: Metadata = {
  title: {
    absolute: "Request a BGV Quote | HireVerify by Brainhunt Ventures",
  },
  description:
    "Request a quotation for employee background verification services from HireVerify by Brainhunt Ventures. Tell us your candidate volume and required checks.",
  keywords: [
    "BGV services quotation",
    "background verification services pricing",
    "employee background check quote India",
    "HireVerify contact",
    "candidate screening services",
  ],
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Request a BGV Quote | HireVerify",
    description:
      "Tell the HireVerify team about your candidate volume and required background checks to discuss service scope and pricing.",
    url: "https://hireverify.brainhuntventures.com/contact",
    siteName: "HireVerify by Brainhunt Ventures",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Contact HireVerify by Brainhunt Ventures",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact HireVerify | Brainhunt Ventures",
    description:
      "Request a background verification services quotation from HireVerify.",
    images: ["/opengraph-image"],
  },
};

export default function ContactPage() {
  return <ContactClient />;
}