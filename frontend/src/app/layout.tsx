import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SABI — AAC Training',
  description: 'AI-powered AAC communication training platform',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-gray-900 text-white min-h-screen">{children}</body>
    </html>
  )
}
