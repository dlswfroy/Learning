
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
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

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
    
    CLASSES.forEach(c => {
      classData[c.id] = {};
    });

    const getChapterName = (item: any) => (item.chapter || item.topic || item.chapterName || 'সাধারণ অধ্যায়').trim();

    // Process PDF Sheets
    allPdfSheets?.forEach(item => {
      const cid = item.classId;
      const sub = item.subject;
      const ch = getChapterName(item);
      if (!classData[cid]) return;
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
      if (!classData[cid][sub]) classData[cid][sub] = {};
      if (!classData[cid][sub][ch]) classData[cid][sub][ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      classData[cid][sub][ch].lectureSheet++;
    });

    return { classData };
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

  const glassClass = "backdrop-blur-xl border-2 border-black shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]";

  return (
    <div className="space-y-8 animate-fade-in font-kalpurush">
      {/* Live Board Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-red-600 text-white flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.8)]">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-black text-foreground">লাইভ কন্টেন্ট বোর্ড</h3>
          </div>
          <Badge className="bg-primary text-white font-bold text-[10px] shadow-[0_0_10px_rgba(37,99,235,0.5)]">রিয়েল-টাইম আপডেট</Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CLASSES.map((cls) => {
            const allSubjects = getSubjectsForClass(cls.id);
            const selectedSubject = selectedSubjects[cls.id] || allSubjects[0];
            const classChapters = stats.classData[cls.id]?.[selectedSubject] || {};
            const chapterNames = Object.keys(classChapters).sort();

            return (
              <Card key={cls.id} className={cn(glassClass, "overflow-hidden bg-white/60")}>
                <CardHeader className="bg-primary/20 border-b border-black p-3 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center border-2 border-white shadow-lg">
                      <GraduationCap className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-black text-sm text-primary-foreground drop-shadow-sm">{cls.label} শ্রেণির বোর্ড</span>
                  </div>
                  <div className="w-36 md:w-44">
                    <Select 
                      value={selectedSubject} 
                      onValueChange={(val) => setSelectedSubjects(prev => ({...prev, [cls.id]: val}))}
                    >
                      <SelectTrigger className="h-8 text-[11px] font-black border-black bg-white/80 backdrop-blur-sm shadow-inner">
                        <SelectValue placeholder="বিষয়" />
                      </SelectTrigger>
                      <SelectContent className="font-kalpurush">
                        {allSubjects.map(sub => (
                          <SelectItem key={sub} value={sub} className="text-[11px] font-bold">{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] font-bold border-collapse">
                      <thead>
                        <tr className="bg-white/80 border-b border-black">
                          <th className="p-2 text-center text-foreground border-r border-black w-1/2">অধ্যায়ের নাম</th>
                          <th className="p-2 text-center text-primary w-1/2">লাইভ কন্টেন্ট তথ্য</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chapterNames.length > 0 ? (
                          chapterNames.map(ch => (
                            <tr key={ch} className="border-b border-black last:border-b-0">
                              <td className="p-2 text-foreground font-black text-center align-middle border-r border-black bg-white/40 break-words backdrop-blur-sm">
                                {ch}
                              </td>
                              <td className="p-0">
                                <table className="w-full h-full border-none">
                                  <tbody className="divide-y divide-black/10">
                                    <tr className="border-b border-black/10 bg-blue-400/10">
                                      <td className="p-1 pl-4 text-blue-700 border-r border-black/10 w-2/3">লেকচার শিট</td>
                                      <td className="p-1 text-center font-black w-1/3 text-blue-800">{toBengaliNumber(classChapters[ch].lectureSheet)}</td>
                                    </tr>
                                    <tr className="border-b border-black/10 bg-orange-400/10">
                                      <td className="p-1 pl-4 text-orange-700 border-r border-black/10 w-2/3">সৃজনশীল</td>
                                      <td className="p-1 text-center font-black w-1/3 text-orange-800">{toBengaliNumber(classChapters[ch].creative)}</td>
                                    </tr>
                                    <tr className="border-b border-black/10 bg-indigo-400/10">
                                      <td className="p-1 pl-4 text-indigo-700 border-r border-black/10 w-2/3">বহুনির্বাচনী</td>
                                      <td className="p-1 text-center font-black w-1/3 text-indigo-800">{toBengaliNumber(classChapters[ch].mcq)}</td>
                                    </tr>
                                    <tr className="border-b border-black/10 bg-green-400/10">
                                      <td className="p-1 pl-4 text-green-700 border-r border-black/10 w-2/3">উত্তরমালা</td>
                                      <td className="p-1 text-center font-black w-1/3 text-green-800">{toBengaliNumber(classChapters[ch].answerKey)}</td>
                                    </tr>
                                    <tr className="bg-rose-400/10">
                                      <td className="p-1 pl-4 text-rose-700 border-r border-black/10 w-2/3">মডেল টেস্ট</td>
                                      <td className="p-1 text-center font-black w-1/3 text-rose-800">{toBengaliNumber(classChapters[ch].modelTest)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="p-6 text-center text-muted-foreground font-bold italic bg-white/20 backdrop-blur-sm">
                              এই বিষয়ের কোনো কন্টেন্ট এখনো নেই।
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Dashboard Cards - 4 columns on mobile, 6 columns on desktop */}
      <section className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-2">
        <Link href="/create-question">
          <Card className={cn(glassClass, "bg-blue-500/30 overflow-hidden group hover:scale-105 hover:bg-blue-500/40 transition-all border-l-4 border-l-blue-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-blue-600 flex items-center justify-center text-white mb-1 shadow-[0_0_15px_rgba(37,99,235,0.8)] group-hover:rotate-12 transition-transform">
                <BrainCircuit className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-blue-800 font-black text-[10px] md:text-[12px] leading-tight drop-shadow-sm">প্রশ্ন ব্যাংক</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-blue-900/80 leading-tight line-clamp-2">বোর্ড স্ট্যান্ডার্ড সৃজনশীল ও এমসিকিউ।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/create-lecture-sheet">
          <Card className={cn(glassClass, "bg-orange-500/30 overflow-hidden group hover:scale-105 hover:bg-orange-500/40 transition-all border-l-4 border-l-orange-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-orange-500 flex items-center justify-center text-white mb-1 shadow-[0_0_15px_rgba(249,115,22,0.8)] group-hover:rotate-12 transition-transform">
                <BookOpen className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-orange-800 font-black text-[10px] md:text-[12px] leading-tight drop-shadow-sm">লেকচার শিট</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-orange-900/80 leading-tight line-clamp-2">অধ্যায় ভিত্তিক লেকচার নোট তৈরি করুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/diary">
          <Card className={cn(glassClass, "bg-indigo-500/30 overflow-hidden group hover:scale-105 hover:bg-indigo-500/40 transition-all border-l-4 border-l-indigo-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-indigo-600 flex items-center justify-center text-white mb-1 shadow-[0_0_15px_rgba(79,70,229,0.8)] group-hover:rotate-12 transition-transform">
                <NotebookPen className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-indigo-800 font-black text-[10px] md:text-[12px] leading-tight drop-shadow-sm">টিচার্স ডায়েরি</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-indigo-900/80 leading-tight line-clamp-2">প্রতিদিনের ক্লাস রেকর্ড লিখে রাখুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/students">
          <Card className={cn(glassClass, "bg-green-500/30 overflow-hidden group hover:scale-105 hover:bg-green-500/40 transition-all border-l-4 border-l-green-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-green-600 flex items-center justify-center text-white mb-1 shadow-[0_0_15px_rgba(22,163,74,0.8)] group-hover:rotate-12 transition-transform">
                <Users className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-green-800 font-black text-[10px] md:text-[12px] leading-tight drop-shadow-sm">শিক্ষার্থী</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-green-900/80 leading-tight line-clamp-2">শিক্ষার্থীদের তথ্য ও হাজিরা পরিচালনা।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings?tab=sheets">
          <Card className={cn(glassClass, "bg-rose-500/30 overflow-hidden group hover:scale-105 hover:bg-rose-500/40 transition-all border-l-4 border-l-rose-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-rose-600 flex items-center justify-center text-white mb-1 shadow-[0_0_15px_rgba(225,29,72,0.8)] group-hover:rotate-12 transition-transform">
                <FileUp className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-rose-800 font-black text-[10px] md:text-[12px] leading-tight drop-shadow-sm">কুইক আপলোড</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-rose-900/80 leading-tight line-clamp-2">সরাসরি শিট বা প্রশ্ন আপলোড করুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/my-questions">
          <Card className={cn(glassClass, "bg-cyan-500/30 overflow-hidden group hover:scale-105 hover:bg-cyan-500/40 transition-all border-l-4 border-l-cyan-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-cyan-500 flex items-center justify-center text-white mb-1 shadow-[0_0_15px_rgba(6,182,212,0.8)] group-hover:rotate-12 transition-transform">
                <Library className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <CardTitle className="text-cyan-900 font-black text-[10px] md:text-[12px] leading-tight drop-shadow-sm">আমার লাইব্রেরি</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-cyan-900/80 leading-tight line-clamp-2">আপনার সব সংগ্রহ এখানে পাবেন।</p>
            </CardContent>
          </Card>
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-2">
          <h3 className="text-lg font-black text-foreground flex items-center gap-2">
            <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-primary drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
            শ্রেণি নির্বাচন করুন
          </h3>
        </div>
        <div className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-2">
          {CLASSES.map((cls) => (
            <Link key={cls.id} href={`/class/${cls.id}`}>
              <Card className={cn(glassClass, "hover:bg-primary/20 hover:scale-105 transition-all group overflow-hidden bg-white/60")}>
                <CardContent className="p-1 flex flex-col items-center text-center space-y-1">
                  <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-primary flex items-center justify-center text-white group-hover:bg-white group-hover:text-primary transition-all shadow-lg border-2 border-white">
                    <GraduationCap className="w-3 h-3 md:w-4 md:h-4" />
                  </div>
                  <div>
                    <p className="font-black text-[10px] md:text-[12px] group-hover:text-primary transition-colors">{cls.label} শ্রেণি</p>
                  </div>
                  <div className="flex items-center gap-0.5 text-[7px] font-black text-primary opacity-80 group-hover:opacity-100 transition-all uppercase tracking-tighter">
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
