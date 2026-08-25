import type { Metadata } from "next";
import ContactClient from "@/src/components/layout/contactClient";

export const metadata: Metadata = {
  title: "Contact Us | HireVerify",
  description:
    "Get in touch with HireVerify for background verification support, enterprise solutions, and partnerships.",
  keywords: [
    "HireVerify Contact",
    "Background Verification Support",
    "Recruitment Software Contact",
    "Customer Support",
  ],
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact HireVerify",
    description:
      "Contact HireVerify for background verification support and enterprise solutions.",
    url: "https://hireverify.brainhuntventures.com/contact",
  },
};

export default function ContactPage() {
  return <ContactClient />;
}