
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

export function BottomNav() {
  const pathname = usePathname();
  const { user, loading } = useUser();

  // If user is not logged in or loading, don't show the bottom nav
  // Also hide on auth page
  if (loading || !user || pathname === '/auth') {
    return null;
  }

  const navItems = [
    { label: 'হোম', icon: LayoutDashboard, href: '/' },
    { label: 'প্রশ্ন তৈরি', icon: PlusCircle, href: '/create-question' },
    { label: 'আমার প্রশ্ন', icon: FileText, href: '/my-questions' },
    { label: 'সেটিং', icon: Settings, href: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-primary border-t border-primary/20 text-primary-foreground z-50 h-20 shadow-lg no-print">
      <div className="h-full max-w-5xl mx-auto flex items-center justify-around overflow-x-auto hide-scrollbar px-4 gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center min-w-[70px] h-16 rounded-xl transition-all relative shrink-0",
                isActive 
                  ? "bg-white/20 text-white" 
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "animate-pulse")} />
              <span className="text-[10px] mt-1 font-medium whitespace-nowrap">{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
