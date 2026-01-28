import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
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
      </body>
    </html>
  )
}
