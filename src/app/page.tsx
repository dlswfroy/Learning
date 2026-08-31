
"use client";

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  GraduationCap, 
  ArrowRight, 
  BrainCircuit, 
  Loader2, 
  BookOpen, 
  Library, 
  Users, 
  NotebookPen, 
  FileUp, 
  LayoutGrid,
  FileText,
  CheckCircle2,
  Trophy,
  Brain
} from 'lucide-react';
import { CLASSES } from '@/lib/constants';
import { collection } from 'firebase/firestore';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();
  const db = useFirestore();

  // Fetch all content for aggregation
  const qQuery = useMemo(() => db ? collection(db, 'questions') : null, [db]);
  const pQuery = useMemo(() => db ? collection(db, 'pdf-sheets') : null, [db]);
  const lQuery = useMemo(() => db ? collection(db, 'lecture-sheets') : null, [db]);

  const { data: allQuestions } = useCollection(qQuery);
  const { data: allPdfSheets } = useCollection(pQuery);
  const { data: allLectureSheets } = useCollection(lQuery);

  // Aggregate stats by class and chapter
  const stats = useMemo(() => {
    const result: Record<string, { label: string, chapters: Record<string, any> }> = {};
    
    CLASSES.forEach(c => {
      result[c.id] = { label: c.label, chapters: {} };
    });

    const getChapterName = (item: any) => (item.chapter || item.topic || item.chapterName || 'সাধারণ').trim();

    // Process PDF Sheets
    allPdfSheets?.forEach(item => {
      const cid = item.classId;
      const ch = getChapterName(item);
      if (!result[cid]) return;
      if (!result[cid].chapters[ch]) result[cid].chapters[ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      
      if (item.category === 'creative') result[cid].chapters[ch].creative++;
      else if (item.category === 'lecture_sheet') result[cid].chapters[ch].lectureSheet++;
      else if (item.category === 'mcq') result[cid].chapters[ch].mcq++;
      else if (item.category === 'answer_key') result[cid].chapters[ch].answerKey++;
      else if (item.category === 'model_test') result[cid].chapters[ch].modelTest++;
    });

    // Process Questions
    allQuestions?.forEach(item => {
      const cid = item.classId;
      const ch = getChapterName(item);
      if (!result[cid]) return;
      if (!result[cid].chapters[ch]) result[cid].chapters[ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      
      if (item.examType === 'model_test') result[cid].chapters[ch].modelTest++;
      else if (item.isMcq) result[cid].chapters[ch].mcq++;
      else result[cid].chapters[ch].creative++;
    });

    // Process Native Lecture Sheets
    allLectureSheets?.forEach(item => {
      const cid = item.classId;
      const ch = getChapterName(item);
      if (!result[cid]) return;
      if (!result[cid].chapters[ch]) result[cid].chapters[ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      result[cid].chapters[ch].lectureSheet++;
    });

    return result;
  }, [allQuestions, allPdfSheets, allLectureSheets]);

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
    <div className="space-y-8 animate-fade-in font-kalpurush">
      {/* Live Board Section */}
      <section className="bg-white border-2 border-black rounded-xl p-4 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-black/10 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-red-600 text-white flex items-center justify-center animate-pulse">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-black text-foreground">লাইভ কন্টেন্ট বোর্ড</h3>
          </div>
          <Badge className="bg-primary text-white font-bold text-[10px]">লাইভ আপডেট</Badge>
        </div>
        
        <Accordion type="single" collapsible className="w-full">
          {CLASSES.map((cls) => {
            const classData = stats[cls.id]?.chapters || {};
            const chapterNames = Object.keys(classData).sort();
            
            if (chapterNames.length === 0) return null;

            return (
              <AccordionItem key={cls.id} value={cls.id} className="border-black/5">
                <AccordionTrigger className="hover:no-underline py-3 px-2 rounded-lg hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-black text-sm">{cls.label} শ্রেণি</span>
                    <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {toBengaliNumber(chapterNames.length)} টি অধ্যায়
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 px-1">
                  <div className="overflow-x-auto rounded-lg border border-black/5 shadow-inner">
                    <table className="w-full text-[11px] font-bold border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-black/10">
                          <th className="p-2 text-left text-primary whitespace-nowrap">অধ্যায়</th>
                          <th className="p-2 text-center text-orange-600">সৃজনশীল</th>
                          <th className="p-2 text-center text-blue-600">লেকচার শিট</th>
                          <th className="p-2 text-center text-indigo-600">বহুনির্বাচনী</th>
                          <th className="p-2 text-center text-green-600">উত্তরমালা</th>
                          <th className="p-2 text-center text-rose-600">মডেল টেস্ট</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {chapterNames.map(ch => (
                          <tr key={ch} className="hover:bg-slate-50/50">
                            <td className="p-2 text-foreground font-black min-w-[120px]">{ch}</td>
                            <td className="p-2 text-center bg-orange-50/20">{toBengaliNumber(classData[ch].creative)}</td>
                            <td className="p-2 text-center bg-blue-50/20">{toBengaliNumber(classData[ch].lectureSheet)}</td>
                            <td className="p-2 text-center bg-indigo-50/20">{toBengaliNumber(classData[ch].mcq)}</td>
                            <td className="p-2 text-center bg-green-50/20">{toBengaliNumber(classData[ch].answerKey)}</td>
                            <td className="p-2 text-center bg-rose-50/20">{toBengaliNumber(classData[ch].modelTest)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
          {Object.values(stats).every(s => Object.keys(s.chapters).length === 0) && (
            <div className="py-10 text-center text-muted-foreground font-bold italic text-sm">
              বর্তমানে কোনো লাইভ কন্টেন্ট নেই।
            </div>
          )}
        </Accordion>
      </section>

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
