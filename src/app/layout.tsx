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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col bg-background">
        <FirebaseClientProvider>
          <Navbar />
          <main className="flex-1 pt-20 pb-12 container mx-auto px-4">
            {children}
          </main>
          <footer className="py-6 text-center text-[10px] text-muted-foreground border-t bg-muted/5 mb-20 no-print font-bold">
            <p className="tracking-widest uppercase">© ২০২৪-২৬ টপ গ্রেড টিউটোরিয়ালস।</p>
            <p className="mt-1 text-primary/60">সর্বস্বত্ব সংরক্ষিত।</p>
          </footer>
          <BottomNav />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}