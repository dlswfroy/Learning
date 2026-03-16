
"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { BookOpenText, LogIn, LogOut, Settings as SettingsIcon } from 'lucide-react';
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
import { toast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';

export function Navbar() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const db = useFirestore();

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

  return (
    <nav className="fixed top-0 left-0 right-0 min-h-14 h-auto py-2 bg-primary text-primary-foreground z-50 shadow-xl flex items-center px-4 md:px-6 no-print border-b border-white/10">
      <Link href="/" className="flex items-center gap-3 group">
        <div className="bg-white p-1 rounded-xl text-primary group-hover:scale-105 transition-transform flex items-center justify-center shadow-lg shrink-0">
          {appLogoUrl ? (
            <img src={appLogoUrl} alt="Logo" className="w-10 h-10 object-contain" />
          ) : (
            <BookOpenText className="w-10 h-10" />
          )}
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl md:text-4xl font-black font-headline tracking-tighter drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] leading-tight text-white uppercase">
            {appName}
          </h1>
          <p className="text-[10px] md:text-xs font-black text-red-500 italic leading-none mt-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
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
