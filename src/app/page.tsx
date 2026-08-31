
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { GraduationCap, ArrowRight, BrainCircuit, Loader2, BookOpen, Library, Users, NotebookPen, FileUp } from 'lucide-react';
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
      {/* Dashboard Cards - 4 columns on mobile, 6 columns on desktop */}
      <section className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-2">
        <Link href="/create-question">
          <Card className="bg-primary/5 border-black shadow-sm overflow-hidden group hover:shadow-md transition-all border-l-2 border-l-primary h-full">
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-primary flex items-center justify-center text-white mb-1 shadow-inner group-hover:scale-105 transition-transform">
                <BrainCircuit className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-primary font-black text-[10px] md:text-[12px] leading-tight">প্রশ্ন ব্যাংক</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight line-clamp-2">বোর্ড স্ট্যান্ডার্ড সৃজনশীল ও এমসিকিউ।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/create-lecture-sheet">
          <Card className="bg-orange-50 border-black shadow-sm overflow-hidden group hover:shadow-md transition-all border-l-2 border-l-orange-500 h-full">
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-orange-500 flex items-center justify-center text-white mb-1 shadow-inner group-hover:scale-105 transition-transform">
                <BookOpen className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-orange-600 font-black text-[10px] md:text-[12px] leading-tight">লেকচার শিট</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight line-clamp-2">অধ্যায় ভিত্তিক লেকচার নোট তৈরি করুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/diary">
          <Card className="bg-indigo-50 border-black shadow-sm overflow-hidden group hover:shadow-md transition-all border-l-2 border-l-indigo-600 h-full">
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-indigo-600 flex items-center justify-center text-white mb-1 shadow-inner group-hover:scale-105 transition-transform">
                <NotebookPen className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-indigo-700 font-black text-[10px] md:text-[12px] leading-tight">টিচার্স ডায়েরি</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight line-clamp-2">প্রতিদিনের ক্লাস রেকর্ড লিখে রাখুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/students">
          <Card className="bg-green-50 border-black shadow-sm overflow-hidden group hover:shadow-md transition-all border-l-2 border-l-green-600 h-full">
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-green-600 flex items-center justify-center text-white mb-1 shadow-inner group-hover:scale-105 transition-transform">
                <Users className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-green-700 font-black text-[10px] md:text-[12px] leading-tight">শিক্ষার্থী</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight line-clamp-2">শিক্ষার্থীদের তথ্য ও হাজিরা পরিচালনা।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings?tab=sheets">
          <Card className="bg-rose-50 border-black shadow-sm overflow-hidden group hover:shadow-md transition-all border-l-2 border-l-rose-600 h-full">
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-rose-600 flex items-center justify-center text-white mb-1 shadow-inner group-hover:scale-105 transition-transform">
                <FileUp className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-rose-700 font-black text-[10px] md:text-[12px] leading-tight">কুইক আপলোড</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight line-clamp-2">সরাসরি শিট বা প্রশ্ন আপলোড করুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/my-questions">
          <Card className="bg-accent/10 border-black shadow-sm overflow-hidden group hover:shadow-md transition-all border-l-2 border-l-accent h-full">
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-accent flex items-center justify-center text-white mb-1 shadow-inner group-hover:scale-105 transition-transform">
                <Library className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-black font-black text-[10px] md:text-[12px] leading-tight">আমার লাইব্রেরি</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground leading-tight line-clamp-2">আপনার সব সংগ্রহ এখানে পাবেন।</p>
            </CardContent>
          </Card>
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6 border-b-2 border-primary/10 pb-2">
          <h3 className="text-lg font-black text-foreground flex items-center gap-2">
            <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            শ্রেণি নির্বাচন করুন
          </h3>
        </div>
        <div className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-2">
          {CLASSES.map((cls) => (
            <Link key={cls.id} href={`/class/${cls.id}`}>
              <Card className="hover:border-primary hover:shadow-md transition-all group overflow-hidden border-2 border-black shadow-sm bg-white">
                <CardContent className="p-1 flex flex-col items-center text-center space-y-1">
                  <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <GraduationCap className="w-3 h-3 md:w-4 md:h-4" />
                  </div>
                  <div>
                    <p className="font-black text-[10px] md:text-[12px] group-hover:text-primary transition-colors">{cls.label} শ্রেণি</p>
                  </div>
                  <div className="flex items-center gap-0.5 text-[7px] font-black text-primary opacity-60 group-hover:opacity-100 transition-all">
                    প্রবেশ <ArrowRight className="w-1.5 h-1.5 transition-transform group-hover:translate-x-0.5" />
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
