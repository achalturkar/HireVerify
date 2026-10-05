import type { Metadata } from "next";
import ContactClient from "@/src/components/layout/contactClient";

export const metadata: Metadata = {
  title: {
    absolute: "Contact HireVerify | Brainhunt Ventures",
  },
  description:
    "Contact HireVerify by Brainhunt Ventures for employee background verification, BGV platform demonstrations, pricing, company onboarding, and customer support in India.",
  keywords: [
    "HireVerify Contact",
    "Background Verification Support",
    "BGV platform demo",
    "background verification pricing India",
    "company onboarding",
  ],
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact HireVerify | Brainhunt Ventures",
    description:
      "Talk to the Brainhunt Ventures team about HireVerify background verification workflows, pricing, onboarding, or support.",
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
      "Request a demo, pricing, onboarding information or support for HireVerify BGV.",
    images: ["/opengraph-image"],
  },
};

export default function ContactPage() {
  return <ContactClient />;
}