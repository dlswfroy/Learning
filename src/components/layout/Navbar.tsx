
"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { BookOpenText, LogIn, LogOut, Settings } from 'lucide-react';
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

  const appName = softwareConfig?.appName || 'আমার প্রশ্ন';
  const appLogoUrl = softwareConfig?.appLogoUrl || '';

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "লগআউট", description: "আপনি সফলভাবে লগআউট করেছেন।" });
    } catch (error) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "লগআউট করা সম্ভব হয়নি।" });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-primary text-primary-foreground z-50 shadow-md flex items-center px-6 no-print">
      <Link href="/" className="flex items-center gap-2 group">
        <div className="bg-white p-1.5 rounded-lg text-primary group-hover:scale-110 transition-transform flex items-center justify-center">
          {appLogoUrl ? (
            <img src={appLogoUrl} alt="Logo" className="w-6 h-6 object-contain" />
          ) : (
            <BookOpenText className="w-6 h-6" />
          )}
        </div>
        <h1 className="text-xl font-bold font-headline tracking-tight">{appName}</h1>
      </Link>
      
      <div className="ml-auto flex items-center gap-4">
        {!loading && (
          user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10 border-2 border-white/20">
                    <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
                    <AvatarFallback className="bg-secondary text-primary font-bold">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName || 'ব্যবহারকারী'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                   <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
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
                className="gap-2 font-bold"
              >
                <LogIn className="w-4 h-4" />
                লগইন
              </Button>
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
