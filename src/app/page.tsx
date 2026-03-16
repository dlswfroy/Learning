"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { GraduationCap, ArrowRight, BookMarked, BrainCircuit, Loader2 } from 'lucide-react';
import { CLASSES } from '@/lib/constants';

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-bold">অ্যাক্সেস চেক করা হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/30 shadow-md overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white mb-2 shadow-inner group-hover:scale-110 transition-transform">
              <BookMarked className="w-7 h-7" />
            </div>
            <CardTitle className="text-primary font-black text-xl">পাঠ্যবই</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm font-bold text-muted-foreground">
              <li className="flex items-center gap-2"><div className="w-2 h-2 bg-primary rounded-full"/> ষষ্ঠ থেকে দশম শ্রেণি</li>
              <li className="flex items-center gap-2"><div className="w-2 h-2 bg-primary rounded-full"/> সকল গুরুত্বপূর্ণ বিষয়</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-accent/10 border-accent/30 shadow-md overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-accent">
          <CardHeader className="pb-2">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-white mb-2 shadow-inner group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <CardTitle className="text-accent-foreground font-black text-xl">প্রশ্ন ব্যাংক</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm font-bold text-muted-foreground">
              <li className="flex items-center gap-2"><div className="w-2 h-2 bg-accent rounded-full"/> বোর্ড স্ট্যান্ডার্ড প্রশ্ন</li>
              <li className="flex items-center gap-2"><div className="w-2 h-2 bg-accent rounded-full"/> সৃজনশীল ও সংক্ষিপ্ত</li>
            </ul>
          </CardContent>
        </Card>

        <div className="md:col-span-2 lg:col-span-1">
          <Card className="h-full flex flex-col justify-center items-center p-8 bg-white border-dashed border-2 border-primary/30 text-center shadow-md hover:border-primary transition-colors">
            <h3 className="font-black text-lg mb-4 text-primary">রিসোর্স ব্যবস্থাপনা</h3>
            <p className="text-xs text-muted-foreground mb-6 font-bold">নতুন বই বা গাইড যুক্ত করতে সেটিংস-এ যান</p>
            <Link href="/settings" className="px-10 py-3 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary/90 transition-all shadow-lg hover:translate-y-[-2px]">
              সেটিং
            </Link>
          </Card>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-8 border-b-2 border-primary/10 pb-2">
          <h3 className="text-2xl font-black text-foreground flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-primary" />
            শ্রেণি নির্বাচন করুন
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {CLASSES.map((cls) => (
            <Link key={cls.id} href={`/class/${cls.id}`}>
              <Card className="hover:border-primary hover:shadow-xl transition-all group overflow-hidden h-full border-2 shadow-sm bg-white">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-5">
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <GraduationCap className="w-9 h-9" />
                  </div>
                  <div>
                    <p className="font-black text-xl group-hover:text-primary transition-colors">{cls.label} শ্রেণি</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-black text-primary opacity-60 group-hover:opacity-100 transition-all">
                    প্রবেশ করুন <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}