import { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  title: 'Compose Post | Skatehive',
  description: 'Create and publish skateboarding content on Skatehive.',
};

export default function ComposeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
