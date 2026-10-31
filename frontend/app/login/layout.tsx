import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'HireVerify Portal Login | Background Verification',
  },
  description:
    'Sign in to the HireVerify portal to manage candidate background verification and review reports. New businesses can contact Brainhunt Ventures to request BGV services.',
  alternates: {
    canonical: '/login',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
