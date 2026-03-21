
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, Settings, BookOpen, Library, Users, NotebookPen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

export function BottomNav() {
  const pathname = usePathname();
  const { user, loading } = useUser();

  if (loading || !user || pathname === '/auth') {
    return null;
  }

  const navItems = [
    { label: 'হোম', icon: LayoutDashboard, href: '/' },
    { label: 'ডায়েরি', icon: NotebookPen, href: '/diary' },
    { label: 'প্রশ্ন তৈরি', icon: PlusCircle, href: '/create-question' },
    { label: 'শিট তৈরি', icon: BookOpen, href: '/create-lecture-sheet' },
    { label: 'শিক্ষার্থী', icon: Users, href: '/students' },
    { label: 'লাইব্রেরি', icon: Library, href: '/my-questions' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-primary border-t border-primary/20 text-primary-foreground z-50 h-14 shadow-lg no-print">
      <div className="h-full max-w-5xl mx-auto flex items-center justify-around px-4 gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center min-w-[50px] h-12 rounded-lg transition-all relative shrink-0",
                isActive 
                  ? "bg-white/20 text-white" 
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "animate-pulse")} />
              <span className="text-[8px] mt-0.5 font-bold whitespace-nowrap">{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-0.5 w-1 h-1 bg-white rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
