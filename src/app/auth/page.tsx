
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
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center space-y-4">
          {/* Branding Section */}
          <div className="flex flex-col items-center gap-2">
            <div className="bg-primary/5 p-2 rounded-2xl shadow-inner border border-primary/10">
              {appLogoUrl ? (
                <img src={appLogoUrl} alt="Logo" className="w-20 h-20 object-contain" />
              ) : (
                <BookOpenText className="w-16 h-16 text-primary" />
              )}
            </div>
            <h1 className="text-2xl font-black text-primary tracking-tighter uppercase">
              {appName}
            </h1>
          </div>
          
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold">
              {isLogin ? 'লগইন করুন' : 'নতুন অ্যাকাউন্ট'}
            </CardTitle>
            <CardDescription>
              {isLogin ? 'আপনার ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন' : 'সিস্টেমে যুক্ত হতে তথ্য প্রদান করুন'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">আপনার নাম</label>
                <Input 
                  placeholder="পুরো নাম লিখুন" 
                  value={name || ''} 
                  onChange={(e) => setName(e.target.value)} 
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold">ইমেইল</label>
              <Input 
                type="email" 
                placeholder="example@gmail.com" 
                value={email || ''} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">পাসওয়ার্ড</label>
              <Input 
                type="password" 
                placeholder="******" 
                value={password || ''} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            <Button className="w-full h-11 font-bold gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />)}
              {isLogin ? 'লগইন' : 'রেজিস্ট্রেশন'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t bg-muted/20 py-4">
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-sm text-primary font-medium hover:underline"
          >
            {isLogin ? 'নতুন অ্যাকাউন্ট তৈরি করতে চান?' : 'ইতিপূর্বে অ্যাকাউন্ট আছে? লগইন করুন'}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
