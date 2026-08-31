
"use client";

import { useMemo, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  BookOpenText, 
  LogIn, 
  LogOut, 
  Settings as SettingsIcon,
  Menu,
  LayoutDashboard,
  NotebookPen,
  PlusCircle,
  BookOpen,
  Users,
  Library,
  ChevronRight
} from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

function NavbarContent() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isPrintMode = searchParams.get('print') === 'true';

  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);

  const userProfileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';
  const appLogoUrl = softwareConfig?.appLogoUrl || '';

  const userName = userProfile?.displayName || user?.displayName || 'ব্যবহারকারী';
  const userPhoto = userProfile?.photoURL || user?.photoURL || '';

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "লগআউট", description: "আপনি সফলভাবে লগআউট করেছেন।" });
    } catch (error) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "লগআউট করা সম্ভব হয়নি।" });
    }
  };

  if (pathname === '/auth' || isPrintMode) {
    return null;
  }

  const navItems = [
    { label: 'হোম', icon: LayoutDashboard, href: '/' },
    { label: 'টিচার্স ডায়েরি', icon: NotebookPen, href: '/diary' },
    { label: 'প্রশ্ন তৈরি', icon: PlusCircle, href: '/create-question' },
    { label: 'শিট তৈরি', icon: BookOpen, href: '/create-lecture-sheet' },
    { label: 'শিক্ষার্থী', icon: Users, href: '/students' },
    { label: 'আমার লাইব্রেরি', icon: Library, href: '/my-questions' },
    { label: 'সেটিংস', icon: SettingsIcon, href: '/settings' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 md:h-[78px] bg-primary text-primary-foreground z-50 shadow-xl flex items-center px-4 md:px-6 no-print border-b border-white/10 font-kalpurush">
      {/* Sidebar Menu Trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2 text-white hover:bg-white/10 shrink-0">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 border-r-primary/20 font-kalpurush">
          <SheetHeader className="p-6 bg-primary text-white border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1.5 rounded-xl text-primary shadow-lg shrink-0">
                {appLogoUrl ? (
                  <img src={appLogoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                ) : (
                  <BookOpenText className="w-8 h-8" />
                )}
              </div>
              <SheetTitle className="text-white text-lg font-black leading-tight text-left">
                {appName}
              </SheetTitle>
            </div>
          </SheetHeader>
          
          <div className="flex flex-col py-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-6 py-4 transition-all hover:bg-primary/5 group",
                      isActive ? "bg-primary/10 text-primary border-r-4 border-primary" : "text-foreground/70"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                      <span className={cn("font-bold text-sm", isActive && "text-primary")}>{item.label}</span>
                    </div>
                    <ChevronRight className={cn("w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity", isActive ? "opacity-100 text-primary" : "text-muted-foreground")} />
                  </Link>
                </SheetClose>
              );
            })}
          </div>
          
          <div className="mt-auto p-6 border-t bg-slate-50">
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">© ২০২৪-২৬ {appName}</p>
          </div>
        </SheetContent>
      </Sheet>

      <Link href="/" className="flex items-center gap-3 group">
        <div className="hidden sm:flex bg-white p-1 rounded-xl text-primary group-hover:scale-105 transition-transform items-center justify-center shadow-lg shrink-0">
          {appLogoUrl ? (
            <img src={appLogoUrl} alt="Logo" className="w-10 h-10 object-contain" />
          ) : (
            <BookOpenText className="w-10 h-10" />
          )}
        </div>
        <div className="flex flex-col">
          <h1 className="text-[25px] md:text-[35px] font-black font-headline tracking-tighter drop-shadow-[0_6px_6px_rgba(0,0,0,1)] leading-tight text-white uppercase scale-y-110 origin-left">
            {appName}
          </h1>
          <p className="text-[10px] md:text-xs font-black text-yellow-400 italic leading-none mt-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
            Smart learning, Bright Future.
          </p>
        </div>
      </Link>
      
      <div className="ml-auto flex items-center gap-2 md:gap-4">
        {!loading && (
          user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-white/30 hover:border-white/60 transition-colors p-0 overflow-hidden">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={userPhoto} alt={userName} />
                    <AvatarFallback className="bg-secondary text-primary font-black">
                      {userName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                   <Link href="/settings" className="cursor-pointer">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <span>সেটিংস</span>
                   </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>লগআউট</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <Button 
                variant="secondary" 
                size="sm" 
                className="gap-2 font-black shadow-lg h-8"
              >
                <LogIn className="w-3.5 h-3.5" />
                লগইন
              </Button>
            </Link>
          )
        )}
      </div>
    </nav>
  );
}

export function Navbar() {
  return (
    <Suspense fallback={null}>
      <NavbarContent />
    </Suspense>
  );
}
