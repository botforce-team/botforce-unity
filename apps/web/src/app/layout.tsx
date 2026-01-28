import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

// Get the app URL for metadata base
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'BOTFORCE Unity',
    template: '%s | BOTFORCE Unity',
  },
  description: 'Invoicing, time tracking, expense management for Austrian/EU service companies',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'BOTFORCE Unity',
    description: 'Invoicing, time tracking, expense management for Austrian/EU service companies',
    images: ['/logo.png'],
    type: 'website',
    siteName: 'BOTFORCE Unity',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BOTFORCE Unity',
    description: 'Invoicing, time tracking, expense management for Austrian/EU service companies',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de-AT">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
