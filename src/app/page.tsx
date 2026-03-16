
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
        <p className="text-muted-foreground font-medium">অ্যাক্সেস চেক করা হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20 shadow-sm overflow-hidden group">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white mb-2">
              <BookMarked className="w-6 h-6" />
            </div>
            <CardTitle className="text-primary">পাঠ্যবই</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-primary rounded-full"/> ষষ্ঠ থেকে দশম শ্রেণি</li>
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-primary rounded-full"/> সকল গুরুত্বপূর্ণ বিষয়</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-accent/10 border-accent/20 shadow-sm overflow-hidden group">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-white mb-2">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <CardTitle className="text-accent-foreground">প্রশ্ন ব্যাংক</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-accent rounded-full"/> বোর্ড স্ট্যান্ডার্ড প্রশ্ন</li>
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-accent rounded-full"/> সৃজনশীল ও সংক্ষিপ্ত</li>
            </ul>
          </CardContent>
        </Card>

        <div className="md:col-span-2 lg:col-span-1">
          <Card className="h-full flex flex-col justify-center items-center p-8 bg-white border-dashed border-2 border-primary/20 text-center">
            <h3 className="font-semibold text-lg mb-4">বই আপলোড</h3>
            <Link href="/settings" className="px-6 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
              সেটিং
            </Link>
          </Card>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-foreground">শ্রেণি নির্বাচন করুন</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {CLASSES.map((cls) => (
            <Link key={cls.id} href={`/class/${cls.id}`}>
              <Card className="hover:border-primary hover:shadow-md transition-all group overflow-hidden h-full">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <GraduationCap className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{cls.label} শ্রেণি</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
