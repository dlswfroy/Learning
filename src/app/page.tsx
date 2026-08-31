
"use client";

import { useEffect, useMemo, useState } from 'react';
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
  FileText
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();
  const db = useFirestore();

  // Selected subjects for each class board
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, string>>({});

  // Fetch all content for aggregation
  const qQuery = useMemo(() => db ? collection(db, 'questions') : null, [db]);
  const pQuery = useMemo(() => db ? collection(db, 'pdf-sheets') : null, [db]);
  const lQuery = useMemo(() => db ? collection(db, 'lecture-sheets') : null, [db]);

  const { data: allQuestions } = useCollection(qQuery);
  const { data: allPdfSheets } = useCollection(pQuery);
  const { data: allLectureSheets } = useCollection(lQuery);

  // Aggregate stats by class, subject and chapter
  const stats = useMemo(() => {
    const classData: Record<string, Record<string, Record<string, any>>> = {};
    const subjectsInClass: Record<string, Set<string>> = {};
    
    CLASSES.forEach(c => {
      classData[c.id] = {};
      subjectsInClass[c.id] = new Set();
    });

    const getChapterName = (item: any) => (item.chapter || item.topic || item.chapterName || 'সাধারণ অধ্যায়').trim();

    // Process PDF Sheets
    allPdfSheets?.forEach(item => {
      const cid = item.classId;
      const sub = item.subject;
      const ch = getChapterName(item);
      if (!classData[cid]) return;
      subjectsInClass[cid].add(sub);
      if (!classData[cid][sub]) classData[cid][sub] = {};
      if (!classData[cid][sub][ch]) classData[cid][sub][ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      
      if (item.category === 'creative') classData[cid][sub][ch].creative++;
      else if (item.category === 'lecture_sheet') classData[cid][sub][ch].lectureSheet++;
      else if (item.category === 'mcq') classData[cid][sub][ch].mcq++;
      else if (item.category === 'answer_key') classData[cid][sub][ch].answerKey++;
      else if (item.category === 'model_test') classData[cid][sub][ch].modelTest++;
    });

    // Process Questions
    allQuestions?.forEach(item => {
      const cid = item.classId;
      const sub = item.subject;
      const ch = getChapterName(item);
      if (!classData[cid]) return;
      subjectsInClass[cid].add(sub);
      if (!classData[cid][sub]) classData[cid][sub] = {};
      if (!classData[cid][sub][ch]) classData[cid][sub][ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      
      if (item.examType === 'model_test') classData[cid][sub][ch].modelTest++;
      else if (item.isMcq) classData[cid][sub][ch].mcq++;
      else classData[cid][sub][ch].creative++;
    });

    // Process Native Lecture Sheets
    allLectureSheets?.forEach(item => {
      const cid = item.classId;
      const sub = item.subject;
      const ch = getChapterName(item);
      if (!classData[cid]) return;
      subjectsInClass[cid].add(sub);
      if (!classData[cid][sub]) classData[cid][sub] = {};
      if (!classData[cid][sub][ch]) classData[cid][sub][ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      classData[cid][sub][ch].lectureSheet++;
    });

    const subjectsArray: Record<string, string[]> = {};
    Object.keys(subjectsInClass).forEach(cid => {
      subjectsArray[cid] = Array.from(subjectsInClass[cid]).sort();
    });

    return { classData, subjectsArray };
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
            const subjects = stats.subjectsArray[cls.id] || [];
            const selectedSubject = selectedSubjects[cls.id] || (subjects.length > 0 ? subjects[0] : '');
            const classChapters = stats.classData[cls.id]?.[selectedSubject] || {};
            const chapterNames = Object.keys(classChapters).sort();
            
            if (subjects.length === 0) return null;

            return (
              <AccordionItem key={cls.id} value={cls.id} className="border-black/5">
                <AccordionTrigger className="hover:no-underline py-3 px-2 rounded-lg hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-black text-sm">শ্রেণি: {cls.label}</span>
                    <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {toBengaliNumber(subjects.length)} টি বিষয়
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 px-1">
                  <div className="overflow-hidden rounded-lg border border-black shadow-inner">
                    <table className="w-full text-[11px] font-bold border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-black">
                          <th className="p-2 text-center text-foreground border-r border-black w-1/2">অধ্যায়ের নাম</th>
                          <th className="p-2 text-center text-primary w-1/2">
                            <Select 
                              value={selectedSubject} 
                              onValueChange={(val) => setSelectedSubjects(prev => ({...prev, [cls.id]: val}))}
                            >
                              <SelectTrigger className="h-7 text-[10px] font-black border-black/20 bg-white">
                                <SelectValue placeholder="বিষয় নির্বাচন করুন" />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects.map(sub => (
                                  <SelectItem key={sub} value={sub} className="text-[10px] font-bold">{sub}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {chapterNames.map(ch => (
                          <tr key={ch} className="border-b border-black last:border-b-0">
                            <td className="p-2 text-foreground font-black text-center align-middle border-r border-black bg-white">
                              {ch}
                            </td>
                            <td className="p-0">
                              <table className="w-full h-full border-none">
                                <tbody className="divide-y divide-black/10">
                                  <tr className="border-b border-black">
                                    <td className="p-1 pl-4 text-blue-600 border-r border-black/10 w-2/3">লেকচার শিট</td>
                                    <td className="p-1 text-center font-black w-1/3">{toBengaliNumber(classChapters[ch].lectureSheet)}</td>
                                  </tr>
                                  <tr className="border-b border-black">
                                    <td className="p-1 pl-4 text-orange-600 border-r border-black/10 w-2/3">সৃজনশীল</td>
                                    <td className="p-1 text-center font-black w-1/3">{toBengaliNumber(classChapters[ch].creative)}</td>
                                  </tr>
                                  <tr className="border-b border-black">
                                    <td className="p-1 pl-4 text-indigo-600 border-r border-black/10 w-2/3">বহুনির্বাচনী</td>
                                    <td className="p-1 text-center font-black w-1/3">{toBengaliNumber(classChapters[ch].mcq)}</td>
                                  </tr>
                                  <tr className="border-b border-black">
                                    <td className="p-1 pl-4 text-green-600 border-r border-black/10 w-2/3">উত্তরমালা</td>
                                    <td className="p-1 text-center font-black w-1/3">{toBengaliNumber(classChapters[ch].answerKey)}</td>
                                  </tr>
                                  <tr>
                                    <td className="p-1 pl-4 text-rose-600 border-r border-black/10 w-2/3">মডেল টেস্ট</td>
                                    <td className="p-1 text-center font-black w-1/3">{toBengaliNumber(classChapters[ch].modelTest)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
          {Object.values(stats.classData).every(s => Object.keys(s).length === 0) && (
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
