
import type {Metadata} from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export const metadata: Metadata = {
  title: 'টপ গ্রেড টিউটোরিয়ালস',
  description: 'আধুনিক শিক্ষা সহায়ক প্ল্যাটফর্ম',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col bg-background">
        <FirebaseClientProvider>
          <Navbar />
          <main className="flex-1 pt-16 pb-10 container mx-auto px-4">
            {children}
          </main>
          <footer className="py-6 text-center text-[10px] text-muted-foreground border-t bg-muted/5 mb-20 no-print">
            © ২০২৪-২৫ টপ গ্রেড টিউটোরিয়ালস। সর্বস্বত্ব সংরক্ষিত।
          </footer>
          <BottomNav />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
