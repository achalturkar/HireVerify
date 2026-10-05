import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Sign in | HireVerify by Brainhunt Ventures',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
