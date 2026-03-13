import Link from 'next/link';
import { BookOpenText } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-primary text-primary-foreground z-50 shadow-md flex items-center px-6">
      <Link href="/" className="flex items-center gap-2 group">
        <div className="bg-white p-1.5 rounded-lg text-primary group-hover:scale-110 transition-transform">
          <BookOpenText className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold font-headline tracking-tight">আমার প্রশ্ন</h1>
      </Link>
      <div className="ml-auto hidden sm:block">
        <span className="text-sm font-medium opacity-90 italic">শিক্ষা হোক আনন্দময়</span>
      </div>
    </nav>
  );
}