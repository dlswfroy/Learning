
"use client";

import { useState, useMemo } from 'react';
import { useAuth, useFirestore, useDoc } from '@/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, LogIn, UserPlus, BookOpenText } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();

  // Fetch Software Config for Logo and App Name
  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';
  const appLogoUrl = softwareConfig?.appLogoUrl || '';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "সফল লগইন", description: "আপনি সফলভাবে লগইন করেছেন।" });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        
        // Check if this is the first user ever to assign admin
        const adminDocRef = doc(db, 'config', 'admin');
        const adminDoc = await getDoc(adminDocRef);
        
        if (!adminDoc.exists()) {
          // First user becomes admin
          await setDoc(adminDocRef, { adminUid: userCredential.user.uid });
          toast({ title: "অভিনন্দন!", description: "আপনি প্রথম ইউজার এবং এডমিন হিসেবে নিযুক্ত হলেন।" });
        } else {
          toast({ title: "সফল রেজিস্ট্রেশন", description: "আপনার অ্যাকাউন্ট তৈরি হয়েছে।" });
        }
      }
      router.push('/');
    } catch (error: any) {
      let message = "অথেনটিকেশন ব্যর্থ হয়েছে।";
      if (error.code === 'auth/email-already-in-use') message = "এই ইমেইলটি ইতিপূর্বে ব্যবহার করা হয়েছে।";
      if (error.code === 'auth/invalid-credential') message = "ইমেইল বা পাসওয়ার্ড ভুল।";
      if (error.code === 'auth/weak-password') message = "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।";
      
      toast({ variant: "destructive", title: "ত্রুটি", description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4 font-kalpurush">
      <Card className="w-full max-w-md shadow-2xl border-primary/10 rounded-3xl overflow-hidden bg-white">
        <CardHeader className="text-center space-y-6 pt-10">
          {/* Branding Section matching screenshot */}
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-3 rounded-2xl shadow-lg border border-primary/5 w-28 h-28 flex items-center justify-center overflow-hidden">
              {appLogoUrl ? (
                <img src={appLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <BookOpenText className="w-16 h-16 text-primary" />
              )}
            </div>
            <h1 className="text-2xl font-black text-primary tracking-tight">
              {appName}
            </h1>
          </div>
          
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold text-foreground/90">
              {isLogin ? 'লগইন করুন' : 'নতুন অ্যাকাউন্ট'}
            </CardTitle>
            <CardDescription className="font-medium text-foreground/60">
              {isLogin ? 'আপনার ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন' : 'সিস্টেমে যুক্ত হতে তথ্য প্রদান করুন'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleAuth} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground/80 ml-1">আপনার নাম</label>
                <Input 
                  placeholder="পুরো নাম লিখুন" 
                  value={name || ''} 
                  onChange={(e) => setName(e.target.value)} 
                  required={!isLogin}
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground/80 ml-1">ইমেইল</label>
              <Input 
                type="email" 
                placeholder="example@gmail.com" 
                value={email || ''} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground/80 ml-1">পাসওয়ার্ড</label>
              <Input 
                type="password" 
                placeholder="******" 
                value={password || ''} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
              />
            </div>
            <Button className="w-full h-12 font-bold gap-2 text-lg rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
              {isLogin ? 'লগইন' : 'রেজিস্ট্রেশন'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t bg-slate-50/50 py-6">
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-sm text-primary font-bold hover:underline transition-all"
          >
            {isLogin ? 'নতুন অ্যাকাউন্ট তৈরি করতে চান?' : 'ইতিপূর্বে অ্যাকাউন্ট আছে? লগইন করুন'}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
