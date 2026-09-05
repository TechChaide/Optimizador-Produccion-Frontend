import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import RootLayoutWrapper from "@/components/RootLayoutWrapper";

export const metadata: Metadata = {
  title: 'Chaide - Módulo de Seguridad',
  description: 'Sueña con un mundo mejor',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <RootLayoutWrapper>
          {children}
        </RootLayoutWrapper>
        <Toaster />
      </body>
    </html>
  );
}
