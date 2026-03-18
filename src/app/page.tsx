
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { GraduationCap, ArrowRight, BrainCircuit, Loader2, BookOpen, Library, Users } from 'lucide-react';
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
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-bold">অ্যাক্সেস চেক করা হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Dashboard Cards - 2 columns on mobile (50% size), 4 on desktop */}
      <section className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Link href="/create-question">
          <Card className="bg-primary/5 border-primary/30 shadow-md overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-primary h-full">
            <CardHeader className="pb-1 p-3 md:p-4">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary flex items-center justify-center text-white mb-2 shadow-inner group-hover:scale-110 transition-transform">
                <BrainCircuit className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-primary font-black text-sm md:text-base">প্রশ্ন ব্যাংক</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight">বোর্ড স্ট্যান্ডার্ড সৃজনশীল ও এমসিকিউ প্রশ্ন তৈরি করুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/create-lecture-sheet">
          <Card className="bg-orange-50 border-orange-200 shadow-md overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-orange-500 h-full">
            <CardHeader className="pb-1 p-3 md:p-4">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white mb-2 shadow-inner group-hover:scale-110 transition-transform">
                <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-orange-600 font-black text-sm md:text-base">লেকচার শিট</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight">অধ্যায় ভিত্তিক লেকচার নোট তৈরি ও প্রিন্ট করুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/students">
          <Card className="bg-green-50 border-green-200 shadow-md overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-green-600 h-full">
            <CardHeader className="pb-1 p-3 md:p-4">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-600 flex items-center justify-center text-white mb-2 shadow-inner group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-green-700 font-black text-sm md:text-base">শিক্ষার্থী</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight">আপনার শিক্ষার্থীদের তথ্য সংরক্ষণ ও পরিচালনা করুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/my-questions">
          <Card className="bg-accent/10 border-accent/30 shadow-md overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-accent h-full">
            <CardHeader className="pb-1 p-3 md:p-4">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-accent flex items-center justify-center text-white mb-2 shadow-inner group-hover:scale-110 transition-transform">
                <Library className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-accent-foreground font-black text-sm md:text-base">আমার লাইব্রেরি</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight">আপনার তৈরি করা প্রশ্ন ও শিটগুলো এখানে পাবেন।</p>
            </CardContent>
          </Card>
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6 border-b-2 border-primary/10 pb-2">
          <h3 className="text-lg font-black text-foreground flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            শ্রেণি নির্বাচন করুন
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {CLASSES.map((cls) => (
            <Link key={cls.id} href={`/class/${cls.id}`}>
              <Card className="hover:border-primary hover:shadow-xl transition-all group overflow-hidden border-2 shadow-sm bg-white">
                <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-base group-hover:text-primary transition-colors">{cls.label} শ্রেণি</p>
                  </div>
                  <div className="flex items-center gap-1 text-[8px] font-black text-primary opacity-60 group-hover:opacity-100 transition-all">
                    প্রবেশ করুন <ArrowRight className="w-2 h-2 transition-transform group-hover:translate-x-1" />
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
