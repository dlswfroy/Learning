
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
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
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

function chunkArray<T>(array: T[], size: number): T[][] {
  if (array.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper to format chapter names for the board display consistently
function formatChapterDisplay(name: string): string {
  if (!name) return '';
  
  // Clean up input
  const cleanName = name.trim();

  // Handle Bengali ordinals: ১ম, ২য়, ৩য়, ৪র্থ, ৫র্থ, ৬ষ্ঠ, ৭ম, ৮ম, ৯ম, ১০ম
  const match = cleanName.match(/^([০-৯]+[মযরর্থষঠ]*)/);
  if (match) {
    let ordinal = match[1];
    // Fix specific typos like ৪থ to ৪র্থ if necessary, though regex usually handles it
    return ordinal;
  }
  
  // For English subjects (Unit 1, Unit 2 etc)
  if (cleanName.toLowerCase().startsWith('unit')) {
    const num = cleanName.match(/\d+/);
    return num ? `U${num[0]}` : cleanName;
  }

  if (cleanName.toLowerCase().startsWith('chapter')) {
    const num = cleanName.match(/\d+/);
    return num ? `C${num[0]}` : cleanName;
  }
  
  // Fallback: Return first word or first few chars
  return cleanName.split(/[\s:]/)[0] || cleanName;
}

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();
  const db = useFirestore();

  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, string>>({});

  const qQuery = useMemo(() => db ? collection(db, 'questions') : null, [db]);
  const pQuery = useMemo(() => db ? collection(db, 'pdf-sheets') : null, [db]);
  const lQuery = useMemo(() => db ? collection(db, 'lecture-sheets') : null, [db]);

  const { data: allQuestions } = useCollection(qQuery);
  const { data: allPdfSheets } = useCollection(pQuery);
  const { data: allLectureSheets } = useCollection(lQuery);

  const stats = useMemo(() => {
    const classData: Record<string, Record<string, Record<string, any>>> = {};
    CLASSES.forEach(c => { classData[c.id] = {}; });
    const getChapterName = (item: any) => (item.chapter || item.topic || item.chapterName || 'সাধারণ অধ্যায়').trim();

    allPdfSheets?.forEach(item => {
      const cid = item.classId; const sub = item.subject; const ch = getChapterName(item);
      if (!classData[cid]) return;
      if (!classData[cid][sub]) classData[cid][sub] = {};
      if (!classData[cid][sub][ch]) classData[cid][sub][ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      if (item.category === 'creative') classData[cid][sub][ch].creative++;
      else if (item.category === 'lecture_sheet') classData[cid][sub][ch].lectureSheet++;
      else if (item.category === 'mcq') classData[cid][sub][ch].mcq++;
      else if (item.category === 'answer_key') classData[cid][sub][ch].answerKey++;
      else if (item.category === 'model_test') classData[cid][sub][ch].modelTest++;
    });

    allQuestions?.forEach(item => {
      const cid = item.classId; const sub = item.subject; const ch = getChapterName(item);
      if (!classData[cid]) return;
      if (!classData[cid][sub]) classData[cid][sub] = {};
      if (!classData[cid][sub][ch]) classData[cid][sub][ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      if (item.examType === 'model_test') classData[cid][sub][ch].modelTest++;
      else if (item.isMcq) classData[cid][sub][ch].mcq++;
      else classData[cid][sub][ch].creative++;
    });

    allLectureSheets?.forEach(item => {
      const cid = item.classId; const sub = item.subject; const ch = getChapterName(item);
      if (!classData[cid]) return;
      if (!classData[cid][sub]) classData[cid][sub] = {};
      if (!classData[cid][sub][ch]) classData[cid][sub][ch] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      classData[cid][sub][ch].lectureSheet++;
    });

    return { classData };
  }, [allQuestions, allPdfSheets, allLectureSheets]);

  useEffect(() => { if (!loading && !user) router.push('/auth'); }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-bold">অ্যাক্সেস চেক করা হচ্ছে...</p>
      </div>
    );
  }

  const glassClass = "backdrop-blur-2xl border-2 border-black shadow-[0_12px_40px_rgba(0,0,0,0.15)]";

  return (
    <div className="space-y-12 animate-fade-in font-kalpurush">
      {/* Live Board Section */}
      <section className="space-y-8">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center animate-bounce shadow-lg border border-white/20">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">লাইভ কন্টেন্ট ড্যাশবোর্ড</h3>
          </div>
          <Badge className="bg-yellow-400 text-black font-black text-[10px] border border-black">রিয়েল-টাইম আপডেট</Badge>
        </div>
        
        <div className="space-y-10">
          {CLASSES.map((cls) => {
            const allSubjects = getSubjectsForClass(cls.id);
            const selectedSubject = selectedSubjects[cls.id] || allSubjects[0];
            const classChapters = stats.classData[cls.id]?.[selectedSubject] || {};
            
            // Get all predefined chapters and merge with any found in DB
            const predefined = getChaptersForSubject(cls.id, selectedSubject);
            const chapterNames = Array.from(new Set([...predefined, ...Object.keys(classChapters)])).sort((a, b) => a.localeCompare(b, 'bn', { numeric: true }));
            
            // Show all chapters by chunking into rows of max 20 for readability
            const chapterChunks = chunkArray(chapterNames, 20); 

            return (
              <div key={cls.id} className={cn(glassClass, "rounded-xl overflow-hidden bg-white/40 p-1")}>
                <div className="overflow-x-auto custom-scrollbar">
                  {chapterChunks.length > 0 ? (
                    chapterChunks.map((chunk, chunkIdx) => (
                      <table key={chunkIdx} className="w-full border-collapse border-2 border-black mb-4 last:mb-0">
                        <tbody className="text-slate-900">
                          {/* Row 1: Class Name & Subject Dropdown & Chapter Names */}
                          <tr className="border-b-2 border-black">
                            <td rowSpan={6} className="w-10 border-r-2 border-black bg-white font-black text-center align-middle whitespace-nowrap px-2 text-black" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
                              শ্রেণি: {cls.label}
                            </td>
                            <td className="w-36 border-r-2 border-black bg-cyan-100 p-1 text-center">
                              <Select 
                                value={selectedSubject} 
                                onValueChange={(val) => setSelectedSubjects(prev => ({...prev, [cls.id]: val}))}
                              >
                                <SelectTrigger className="h-7 text-[10px] font-black border-black bg-white">
                                  <SelectValue placeholder="বিষয়" />
                                </SelectTrigger>
                                <SelectContent className="font-kalpurush">
                                  {allSubjects.map(sub => (
                                    <SelectItem key={sub} value={sub} className="text-[11px] font-bold">{sub}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="text-[8px] font-black mt-0.5 text-cyan-900 uppercase">ড্রপ ডাউন</div>
                            </td>
                            {chunk.map(ch => (
                              <td key={ch} className="min-w-[45px] border-r-2 border-black bg-yellow-100 p-1.5 text-center font-black text-[10px] align-middle text-black">
                                {formatChapterDisplay(ch)}
                              </td>
                            ))}
                          </tr>

                          {/* Row 2: Lecture Sheet */}
                          <tr className="border-b border-black bg-blue-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-blue-900">লেকচার শিট</td>
                            {chunk.map(ch => (
                              <td key={ch} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                {toBengaliNumber(classChapters[ch]?.lectureSheet || 0)}
                              </td>
                            ))}
                          </tr>

                          {/* Row 3: Creative */}
                          <tr className="border-b border-black bg-orange-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-orange-900">সৃজনশীল</td>
                            {chunk.map(ch => (
                              <td key={ch} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                {toBengaliNumber(classChapters[ch]?.creative || 0)}
                              </td>
                            ))}
                          </tr>

                          {/* Row 4: MCQ */}
                          <tr className="border-b border-black bg-indigo-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-indigo-900">বহুনির্বাচনী</td>
                            {chunk.map(ch => (
                              <td key={ch} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                {toBengaliNumber(classChapters[ch]?.mcq || 0)}
                              </td>
                            ))}
                          </tr>

                          {/* Row 5: Answer Key */}
                          <tr className="border-b border-black bg-green-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-green-900">উত্তরমালা</td>
                            {chunk.map(ch => (
                              <td key={ch} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                {toBengaliNumber(classChapters[ch]?.answerKey || 0)}
                              </td>
                            ))}
                          </tr>

                          {/* Row 6: Model Test */}
                          <tr className="bg-rose-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-rose-900">মডেল টেস্ট</td>
                            {chunk.map(ch => (
                              <td key={ch} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                {toBengaliNumber(classChapters[ch]?.modelTest || 0)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    ))
                  ) : (
                    <div className="p-10 text-center bg-white/20 border-2 border-black rounded-lg">
                       <p className="text-black font-black text-lg uppercase">এই বিষয়ের কোনো ডাটা পাওয়া যায়নি</p>
                       <p className="text-[10px] font-bold text-muted-foreground">ড্রপ-ডাউন থেকে অন্য বিষয় সিলেক্ট করে দেখুন</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dashboard Cards - 4 columns on mobile, 6 columns on desktop */}
      <section className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-2">
        <Link href="/create-question">
          <Card className={cn(glassClass, "bg-blue-500/10 overflow-hidden group hover:scale-105 transition-all border-l-4 border-l-blue-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-blue-600 flex items-center justify-center text-white mb-1 shadow-md group-hover:rotate-12 transition-transform">
                <BrainCircuit className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-blue-900 font-black text-[10px] md:text-[12px] leading-tight">প্রশ্ন ব্যাংক</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-blue-900/60 leading-tight line-clamp-2">বোর্ড স্ট্যান্ডার্ড সৃজনশীল ও এমসিকিউ।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/create-lecture-sheet">
          <Card className={cn(glassClass, "bg-orange-500/10 overflow-hidden group hover:scale-105 transition-all border-l-4 border-l-orange-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-orange-500 flex items-center justify-center text-white mb-1 shadow-md group-hover:rotate-12 transition-transform">
                <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-orange-900 font-black text-[10px] md:text-[12px] leading-tight">লেকচার শিট</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-orange-900/60 leading-tight line-clamp-2">অধ্যায় ভিত্তিক লেকচার নোট তৈরি করুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/diary">
          <Card className={cn(glassClass, "bg-indigo-500/10 overflow-hidden group hover:scale-105 transition-all border-l-4 border-l-indigo-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-indigo-600 flex items-center justify-center text-white mb-1 shadow-md group-hover:rotate-12 transition-transform">
                <NotebookPen className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-indigo-900 font-black text-[10px] md:text-[12px] leading-tight">টিচার্স ডায়েরি</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-indigo-900/60 leading-tight line-clamp-2">প্রতিদিনের ক্লাস রেকর্ড লিখে রাখুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/students">
          <Card className={cn(glassClass, "bg-green-500/10 overflow-hidden group hover:scale-105 transition-all border-l-4 border-l-green-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-green-600 flex items-center justify-center text-white mb-1 shadow-md group-hover:rotate-12 transition-transform">
                <Users className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-green-900 font-black text-[10px] md:text-[12px] leading-tight">শিক্ষার্থী</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-green-900/60 leading-tight line-clamp-2">শিক্ষার্থীদের তথ্য ও হাজিরা পরিচালনা।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings?tab=sheets">
          <Card className={cn(glassClass, "bg-rose-500/10 overflow-hidden group hover:scale-105 transition-all border-l-4 border-l-rose-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-rose-600 flex items-center justify-center text-white mb-1 shadow-md group-hover:rotate-12 transition-transform">
                <FileUp className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-rose-900 font-black text-[10px] md:text-[12px] leading-tight">কুইক আপলোড</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-rose-900/60 leading-tight line-clamp-2">সরাসরি শিট বা প্রশ্ন আপলোড করুন।</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/my-questions">
          <Card className={cn(glassClass, "bg-cyan-500/10 overflow-hidden group hover:scale-105 transition-all border-l-4 border-l-cyan-600 h-full")}>
            <CardHeader className="p-1">
              <div className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-cyan-500 flex items-center justify-center text-white mb-1 shadow-md group-hover:rotate-12 transition-transform">
                <Library className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <CardTitle className="text-cyan-900 font-black text-[10px] md:text-[12px] leading-tight">আমার লাইব্রেরি</CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <p className="text-[9px] md:text-[10px] font-black text-cyan-900/60 leading-tight line-clamp-2">আপনার সব সংগ্রহ এখানে পাবেন।</p>
            </CardContent>
          </Card>
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-2">
          <h3 className="text-lg font-black text-foreground flex items-center gap-2">
            <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            শ্রেণি নির্বাচন করুন
          </h3>
        </div>
        <div className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-2">
          {CLASSES.map((cls) => (
            <Link key={cls.id} href={`/class/${cls.id}`}>
              <Card className={cn(glassClass, "hover:bg-primary/10 hover:scale-105 transition-all group overflow-hidden bg-white/60")}>
                <CardContent className="p-1 flex flex-col items-center text-center space-y-1">
                  <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-primary flex items-center justify-center text-white group-hover:bg-white group-hover:text-primary transition-all shadow-md border-2 border-white">
                    <GraduationCap className="w-4 h-4 md:w-5 md:h-5" />
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
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 10px; }
      `}</style>
    </div>
  );
}

