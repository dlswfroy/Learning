
"use client";

import Link from 'next/link';
import { BookOpenText, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useUser, useAuth } from '@/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
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

export function Navbar() {
  const { user, loading } = useUser();
  const auth = useAuth();

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast({ title: "সফল লগইন", description: "আপনি সফলভাবে লগইন করেছেন।" });
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "গুগল লগইন করা সম্ভব হয়নি।";
      const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
      
      if (error.code === 'auth/unauthorized-domain') {
        errorMessage = `এই ডোমেইনটি (${currentDomain}) ফায়ারবেসে অনুমোদিত নয়। ফায়ারবেস কনসোলে Authorized Domains এ এটি যুক্ত করুন।`;
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "পপ-আপ ব্লক করা আছে। ব্রাউজার সেটিংস চেক করুন।";
      }

      toast({ 
        variant: "destructive", 
        title: "লগইন ব্যর্থ", 
        description: errorMessage 
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "লগআউট", description: "আপনি লগআউট করেছেন।" });
    } catch (error) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "লগআউট করা সম্ভব হয়নি।" });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-primary text-primary-foreground z-50 shadow-md flex items-center px-6">
      <Link href="/" className="flex items-center gap-2 group">
        <div className="bg-white p-1.5 rounded-lg text-primary group-hover:scale-110 transition-transform">
          <BookOpenText className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold font-headline tracking-tight">আমার প্রশ্ন</h1>
      </Link>
      
      <div className="ml-auto flex items-center gap-4">
        {!loading && (
          user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10 border-2 border-white/20">
                    <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
                    <AvatarFallback><UserIcon className="w-5 h-5" /></AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>লগআউট</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleLogin}
              className="gap-2 font-bold"
            >
              <LogIn className="w-4 h-4" />
              লগইন
            </Button>
          )
        )}
      </div>
    </nav>
  );
}
