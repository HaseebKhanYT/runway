import {ClerkProvider} from '@clerk/nextjs';
import type {Metadata} from 'next';
import {Instrument_Sans} from 'next/font/google';
import type {ReactNode} from 'react';
import './globals.css';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument-sans',
});

export const metadata: Metadata = {
  title: 'Runway',
  description: 'One number tells you what’s safe to spend, every day.',
};

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <ClerkProvider>
      <html lang="en" className={instrumentSans.variable}>
        <body
          style={{
            fontFamily: 'var(--font-instrument-sans), system-ui, sans-serif',
          }}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
