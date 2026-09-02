
"use client";

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Edit, 
  Trash2, 
  Loader2, 
  Calendar, 
  BookOpen, 
  GraduationCap, 
  Library as LibraryIcon,
  Book,
  Printer,
  ChevronRight,
  Folder,
  BrainCircuit,
  ArrowLeft,
  CheckCircle2,
  X,
  PlusCircle,
  FilePlus,
  HelpCircle,
  Layers,
  LayoutGrid,
  ExternalLink,
  Download,
  AlertTriangle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function getNormalizedChapterKey(name: string): string {
  if (!name) return 'general';
  let n = name.toString().toLowerCase().trim();
  const bnToEn: Record<string, string> = { '০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9' };
  n = n.replace(/[০-৯]/g, m => bnToEn[m]);
  
  const wordMap: Record<string, string> = {
    'প্রথম': '1', '১ম': '1', '১': '1', '1st': '1',
    'দ্বিতীয়': '2', '২য়': '2', '২': '2', '2nd': '2',
    'তৃতীয়': '3', '৩য়': '3', '৩': '3', '3rd': '3',
    'চতুর্থ': '4', '৪র্থ': '4', '৪': '4', '4th': '4',
    'পঞ্চম': '5', '৫ম': '5', '৫': '5', '5th': '5',
    'ষষ্ঠ': '6', '৬ষ্ঠ': '6', '৬': '6', '6th': '6',
    'সপ্তম': '7', '৭ম': '7', '৭': '7', '7th': '7',
    'অষ্টম': '8', '৮ম': '8', '৮': '8', '8th': '8',
    'নবম': '9', '৯ম': '9', '৯': '9', '9th': '9',
    'দশম': '10', '১০ম': '10', '১০': '10', '10th': '10',
    'একাদশ': '11', '১১': '11', '১১শ': '11',
    'দ্বাদশ': '12', '১২': '12', '১২শ': '12',
    'ত্রয়োদশ': '13', '১৩': '13', '১৩শ': '13',
    'চতুর্দশ': '14', '১৪': '14', '১৪শ': '14',
    'পঞ্চদশ': '15', '১৫': '15', '১৫শ': '15'
  };

  for (const [word, val] of Object.entries(wordMap)) {
    if (n.includes(word)) return val;
  }

  const match = n.match(/\d+/);
  return match ? match[0] : n;
}

function getChapterSortValue(name: string): number {
  const norm = getNormalizedChapterKey(name);
  const num = parseInt(norm);
  return isNaN(num) ? 998 : num;
}

type ViewMode = 'classes' | 'subjects' | 'chapters' | 'content';
type Category = 'all' | 'sheet' | 'creative' | 'mcq' | 'model' | 'answer';

function MyLibraryContent() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  useEffect(() => { if (!userLoading && !user) router.push('/auth'); }, [user, userLoading, router]);

  useEffect(() => {
    const cid = searchParams.get('classId');
    const sub = searchParams.get('subject');
    const ch = searchParams.get('chapter');
    const cat = searchParams.get('category');

    if (cid && sub && ch && cat) {
      setSelectedClass(cid);
      setSelectedSubject(sub);
      setSelectedChapter(ch);
      setActiveCategory(cat as any);
      setViewMode('content');
    }
  }, [searchParams]);

  const questionsQuery = useMemo(() => db && user ? query(collection(db, 'questions'), where('userId', '==', user.uid)) : null, [db, user]);
  const sheetsQuery = useMemo(() => db && user ? query(collection(db, 'lecture-sheets'), where('userId', '==', user.uid)) : null, [db, user]);
  const pdfSheetsQuery = useMemo(() => db && user ? query(collection(db, 'pdf-sheets')) : null, [db, user]);

  const { data: rawQuestions, loading: questionsLoading, error: qError } = useCollection(questionsQuery);
  const { data: rawSheets, loading: sheetsLoading, error: sError } = useCollection(sheetsQuery);
  const { data: rawPdfSheets, loading: pdfSheetsLoading, error: pError } = useCollection(pdfSheetsQuery);

  const libraryData = useMemo(() => ({ 
    questions: rawQuestions || [], 
    sheets: rawSheets || [],
    pdfSheets: rawPdfSheets || []
  }), [rawQuestions, rawSheets, rawPdfSheets]);

  const currentSubjects = useMemo(() => {
    if (!selectedClass) return [];
    const predefined = getSubjectsForClass(selectedClass);
    const fromDb = [
      ...libraryData.questions.filter(q => q.classId === selectedClass).map(q => q.subject),
      ...libraryData.sheets.filter(s => s.classId === selectedClass).map(s => s.subject),
      ...libraryData.pdfSheets.filter(p => p.classId === selectedClass).map(p => p.subject)
    ].filter(Boolean) as string[];
    return Array.from(new Set([...predefined, ...fromDb])).sort((a, b) => a.localeCompare(b, 'bn'));
  }, [selectedClass, libraryData]);

  const currentChapters = useMemo(() => {
    if (!selectedClass || !selectedSubject) return [];
    const predefinedList = getChaptersForSubject(selectedClass, selectedSubject);
    const itemsInSubj = [
       ...libraryData.questions.filter(q => q.classId === selectedClass && q.subject === selectedSubject),
       ...libraryData.sheets.filter(s => s.classId === selectedClass && s.subject === selectedSubject),
       ...libraryData.pdfSheets.filter(p => p.classId === selectedClass && p.subject === selectedSubject)
    ];
    const dbChapters = itemsInSubj.map(i => (i as any).chapter || (i as any).topic || (i as any).chapterName).filter(Boolean) as string[];
    const chapterMap = new Map<string, string>();
    [...predefinedList, ...dbChapters].forEach(name => {
      const key = getNormalizedChapterKey(name);
      if (!chapterMap.has(key) || (predefinedList.includes(name) && !predefinedList.includes(chapterMap.get(key)!))) {
        chapterMap.set(key, name);
      }
    });
    const sortedChapters = Array.from(chapterMap.values()).sort((a, b) => {
      const valA = getChapterSortValue(a);
      const valB = getChapterSortValue(b);
      if (valA !== valB) return valA - valB;
      return a.localeCompare(b, 'bn');
    });
    const hasUncategorized = itemsInSubj.some(i => !(i as any).chapter && !(i as any).topic && !(i as any).chapterName);
    if (hasUncategorized && !chapterMap.has('general')) {
      sortedChapters.unshift('সাধারণ অধ্যায়');
    }
    return sortedChapters.length > 0 ? sortedChapters : ['সাধারণ অধ্যায়'];
  }, [selectedClass, selectedSubject, libraryData]);

  const currentItems = useMemo(() => {
    let qs = libraryData.questions;
    let ss = libraryData.sheets;
    let ps = libraryData.pdfSheets;

    if (selectedClass) { 
      qs = qs.filter(q => q.classId === selectedClass); 
      ss = ss.filter(s => s.classId === selectedClass);
      ps = ps.filter(p => p.classId === selectedClass);
    }
    if (selectedSubject) { 
      qs = qs.filter(q => q.subject === selectedSubject); 
      ss = ss.filter(s => s.subject === selectedSubject);
      ps = ps.filter(p => p.subject === selectedSubject);
    }
    if (selectedChapter) { 
      const isGeneral = selectedChapter === 'সাধারণ অধ্যায়';
      const selectedKey = getNormalizedChapterKey(selectedChapter);
      qs = qs.filter(q => isGeneral ? (!q.chapter) : (getNormalizedChapterKey(q.chapter) === selectedKey));
      ss = ss.filter(s => isGeneral ? (!s.topic) : (getNormalizedChapterKey(s.topic) === selectedKey));
      ps = ps.filter(p => isGeneral ? (!p.chapterName) : (getNormalizedChapterKey(p.chapterName) === selectedKey));
    }

    if (activeCategory === 'sheet') {
      qs = [];
      ss = ss.filter(s => s.type === 'lecture_sheet' || !s.type);
      ps = ps.filter(p => p.category === 'lecture_sheet');
    } else if (activeCategory === 'creative') {
      qs = qs.filter(q => !q.isMcq && q.examType !== 'model_test');
      ss = ss.filter(s => s.type === 'creative');
      ps = ps.filter(p => p.category === 'creative');
    } else if (activeCategory === 'mcq') {
      qs = qs.filter(q => q.isMcq && q.examType !== 'model_test');
      ss = ss.filter(s => s.type === 'mcq');
      ps = ps.filter(p => p.category === 'mcq');
    } else if (activeCategory === 'model') {
      qs = qs.filter(q => q.examType === 'model_test');
      ss = [];
      ps = ps.filter(p => p.category === 'model_test');
    } else if (activeCategory === 'answer') {
      qs = [];
      ss = [];
      ps = ps.filter(p => p.category === 'answer_key');
    }

    return { questions: qs, sheets: ss, pdfSheets: ps };
  }, [libraryData, selectedClass, selectedSubject, selectedChapter, activeCategory]);

  const getChapterStats = (chapterName: string) => {
    const isGeneral = chapterName === 'সাধারণ অধ্যায়';
    const key = getNormalizedChapterKey(chapterName);
    const chapterSheets = libraryData.sheets.filter(s => s.classId === selectedClass && s.subject === selectedSubject && (isGeneral ? !s.topic : getNormalizedChapterKey(s.topic) === key));
    const chapterPdfSheets = libraryData.pdfSheets.filter(p => p.classId === selectedClass && p.subject === selectedSubject && (isGeneral ? !p.chapterName : getNormalizedChapterKey(p.chapterName) === key));
    const chapterQuestionSets = libraryData.questions.filter(q => q.classId === selectedClass && q.subject === selectedSubject && (isGeneral ? !q.chapter : getNormalizedChapterKey(q.chapter) === key));
    
    let totalQuestions = 0, mcqCount = 0, creativeCount = 0;
    chapterQuestionSets.forEach(set => {
      if (set.questions) {
        totalQuestions += set.questions.length;
        set.questions.forEach((q: any) => { if (q.type === 'mcq') mcqCount++; else if (q.type === 'creative') creativeCount++; });
      }
    });
    return { sheets: chapterSheets.length + chapterPdfSheets.length, total: totalQuestions, mcq: mcqCount, creative: creativeCount };
  };

  const toggleSelection = (id: string) => { if (!isSelecting) return; setSelectedDocIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };

  const handleMergeAndCreate = async () => {
    if (selectedDocIds.length < 1) return;
    setMerging(true);
    try {
      const mergedQuestions: any[] = [];
      const promises = selectedDocIds.map(id => getDocs(query(collection(db!, 'questions'), where('userId', '==', user!.uid))));
      const results = await Promise.all(promises);
      results.forEach(snap => snap.docs.forEach(doc => { if (selectedDocIds.includes(doc.id)) { const data = doc.data(); if (data.questions) mergedQuestions.push(...data.questions); } }));
      if (mergedQuestions.length === 0) { toast({ variant: "destructive", title: "ত্রুটি", description: "কোনো প্রশ্ন পাওয়া যায়নি।" }); return; }
      sessionStorage.setItem('merged_questions_data', JSON.stringify(mergedQuestions));
      router.push('/create-question?source=merge');
    } catch (e) { toast({ variant: "destructive", title: "ত্রুটি", description: "প্রশ্ন একত্রীকরণ ব্যর্থ হয়েছে।" }); }
    finally { setMerging(false); }
  };

  const handleDelete = async (id: string, type: 'questions' | 'lecture-sheets' | 'pdf-sheets') => {
    try { await deleteDoc(doc(db!, type, id)); toast({ title: "সফল", description: "আইটেমটি মুছে ফেলা হয়েছে।" }); }
    catch (e) { toast({ variant: "destructive", title: "ত্রুটি", description: "মুছে ফেলা সম্ভব হয়নি।" }); }
  };

  const handleBack = () => {
    if (isSelecting) { setIsSelecting(false); setSelectedDocIds([]); return; }
    if (viewMode === 'content') { setViewMode('chapters'); setSelectedChapter(null); setActiveCategory('all'); return; }
    if (viewMode === 'chapters') { setViewMode('subjects'); setSelectedSubject(null); return; }
    if (viewMode === 'subjects') { setViewMode('classes'); setSelectedClass(null); return; }
    router.back();
  };

  const renderClasses = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {CLASSES.map(cls => (
        <Card key={cls.id} onClick={() => { setSelectedClass(cls.id); setViewMode('subjects'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2 border-black">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
              <GraduationCap className="w-6 h-6" />
            </div>
            <p className="font-black text-base">{cls.label} শ্রেণি</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderSubjects = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {currentSubjects.map(sub => (
        <Card key={sub} onClick={() => { setSelectedSubject(sub); setViewMode('chapters'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2 border-black">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-orange-50/10 flex items-center justify-center text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-all">
              <Book className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderChapters = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {currentChapters.map(ch => {
        const stats = getChapterStats(ch);
        return (
          <Card key={ch} onClick={() => { setSelectedChapter(ch); setViewMode('content'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2 border-black bg-slate-50/30 overflow-hidden">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <p className="font-bold text-xs flex-1 line-clamp-2">{ch}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded"><FileText className="w-3 h-3" /> সিট/পিডিএফ: {toBengaliNumber(stats.sheets)}</div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded"><BrainCircuit className="w-3 h-3" /> প্রশ্ন: {toBengaliNumber(stats.total)}</div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded">সৃজনশীল: {toBengaliNumber(stats.creative)}</div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-700 bg-orange-100/50 px-2 py-1 rounded">MCQ: {toBengaliNumber(stats.mcq)}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderSubjectContent = () => (
    <div className="space-y-10">
      <section className="space-y-4">
        <h3 className="text-sm font-black text-primary flex items-center gap-2 border-b-2 border-black pb-2 uppercase tracking-wider"><PlusCircle className="w-4 h-4" /> নতুন তৈরি করুন ({selectedChapter})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href={`/create-lecture-sheet?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&topic=${encodeURIComponent(selectedChapter === 'সাধারণ অধ্যায়' ? '' : (selectedChapter || ''))}`}>
            <Card className="hover:border-orange-500 hover:shadow-lg transition-all group border-l-4 border-l-orange-500 border-t-2 border-r-2 border-b-2 border-black cursor-pointer bg-orange-50/30">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform"><FilePlus className="w-6 h-6" /></div>
                <div><h4 className="font-black text-orange-700">লেকচার শিট</h4><p className="text-[10px] font-bold text-muted-foreground">এই অধ্যায়ের নোট তৈরি করুন</p></div>
              </CardContent>
            </Card>
          </Link>
          <Dialog>
            <DialogTrigger asChild>
              <Card className="hover:border-primary hover:shadow-lg transition-all group border-l-4 border-l-primary border-t-2 border-r-2 border-b-2 border-black cursor-pointer bg-blue-50/30">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white group-hover:scale-110 transition-transform"><BrainCircuit className="w-6 h-6" /></div>
                  <div><h4 className="font-black text-primary">প্রশ্নপত্র</h4><p className="text-[10px] font-bold text-muted-foreground">এই অধ্যায়ের প্রশ্ন তৈরি করুন</p></div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="font-kalpurush border-2 border-black">
              <DialogHeader><DialogTitle className="font-black text-primary text-xl">প্রশ্নের ধরন নির্বাচন করুন</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                <Button variant="outline" className="h-14 font-bold gap-3 justify-start px-6 border-black" onClick={() => router.push(`/create-question?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&chapter=${encodeURIComponent(selectedChapter === 'সাধারণ অধ্যায়' ? '' : (selectedChapter || ''))}&type=creative`)}>
                  <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center"><FileText className="w-4 h-4" /></div>সৃজনশীল প্রশ্নপত্র</Button>
                <Button variant="outline" className="h-14 font-bold gap-3 justify-start px-6 border-black" onClick={() => router.push(`/create-question?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&chapter=${encodeURIComponent(selectedChapter === 'সাধারণ অধ্যায়' ? '' : (selectedChapter || ''))}&type=mcq`)}>
                  <div className="w-8 h-8 rounded bg-orange-100 text-orange-600 flex items-center justify-center"><BrainCircuit className="w-4 h-4" /></div>বহুনির্বাচনি (MCQ) প্রশ্নপত্র</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 border-b-2 border-black pb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2 uppercase tracking-wider"><Folder className="w-4 h-4" /> আমার সংগ্রহ ({toBengaliNumber(currentItems.questions.length + currentItems.sheets.length + currentItems.pdfSheets.length)})</h3>
            {currentItems.questions.length > 0 && (
              <Button variant={isSelecting ? "destructive" : "outline"} size="sm" onClick={() => { setIsSelecting(!isSelecting); setSelectedDocIds([]); }} className="h-8 gap-2 font-bold text-xs border-black">
                {isSelecting ? <X className="w-3.5 h-3.5" /> : <BrainCircuit className="w-3.5 h-3.5" />}{isSelecting ? "বাতিল" : "প্রশ্ন বাছাই করুন"}</Button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'সবগুলো', icon: LayoutGrid },
              { id: 'sheet', label: 'লেকচার শিট', icon: BookOpen },
              { id: 'creative', label: 'সৃজনশীল প্রশ্ন', icon: FileText },
              { id: 'mcq', label: 'বহুনির্বাচনী প্রশ্ন', icon: BrainCircuit },
              { id: 'model', label: 'মডেল টেস্ট', icon: BrainCircuit },
              { id: 'answer', label: 'উত্তরমালা', icon: CheckCircle2 }
            ].map((cat) => (
              <Button 
                key={cat.id} 
                variant={activeCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(cat.id as any)}
                className={cn("h-9 gap-2 font-bold text-xs rounded-full border-black", activeCategory === cat.id ? "bg-primary text-white" : "text-muted-foreground")}
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentItems.sheets.map(s => (
            <Card key={s.id} className="hover:border-orange-400 transition-all shadow-sm bg-white border-2 border-black">
              <CardHeader className="pb-3 p-4">
                <div className="flex justify-between items-start">
                   <div className="flex items-center gap-3 pr-4 min-w-0">
                     <div className="w-8 h-8 rounded bg-orange-50 flex items-center justify-center text-orange-600 shrink-0"><BookOpen className="w-4 h-4" /></div>
                     <CardTitle className="text-sm font-bold truncate">{s.topic || 'শিরোনামহীন শিট'}</CardTitle>
                   </div>
                   <div className="flex gap-1">
                     <Link href={`/create-lecture-sheet?id=${s.id}`}><Button variant="ghost" size="icon" className="h-7 w-7 text-primary"><Edit className="w-3.5 h-3.5" /></Button></Link>
                     <AlertDialog>
                       <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                       <AlertDialogContent className="font-kalpurush border-2 border-black"><AlertDialogHeader><AlertDialogTitle className="font-bold">মুছে ফেলবেন?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-black">বাতিল</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(s.id, 'lecture-sheets')} className="bg-destructive text-white">মুছে ফেলা হয়েছে</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                     </AlertDialog>
                   </div>
                </div>
              </CardHeader>
              <CardFooter className="pt-0 p-4 flex justify-between items-center text-[9px] font-bold text-muted-foreground bg-slate-50/50 rounded-b-lg">
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[8px] h-4 font-bold px-1.5 border-black">{s.type === 'creative' ? 'সৃজনশীল শিট' : s.type === 'mcq' ? 'MCQ শিট' : 'লেকচার শিট'}</Badge>
                  <Calendar className="w-3 h-3 ml-2 mr-1" /> {s.updatedAt?.toDate ? format(s.updatedAt.toDate(), 'dd MMM, yy', { locale: bn }) : ''}
                </span>
                <Link href={`/create-lecture-sheet?id=${s.id}&print=true`}><Button size="sm" variant="outline" className="h-6 text-[9px] font-bold gap-1 border-black text-orange-600"><Printer className="w-3 h-3" /> প্রিন্ট</Button></Link>
              </CardFooter>
            </Card>
          ))}

          {currentItems.pdfSheets.map(ps => (
            <Card key={ps.id} className="hover:border-indigo-400 transition-all shadow-sm bg-white border-2 border-black">
              <CardHeader className="pb-3 p-4">
                <div className="flex justify-between items-start">
                   <div className="flex items-center gap-3 pr-4 min-w-0">
                     <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0"><FileText className="w-4 h-4" /></div>
                     <CardTitle className="text-sm font-bold truncate">{ps.chapterName} - {ps.subject}</CardTitle>
                   </div>
                   <div className="flex gap-1">
                     <a href={ps.pdfUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600"><ExternalLink className="w-3.5 h-3.5" /></Button></a>
                     <AlertDialog>
                       <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                       <AlertDialogContent className="font-kalpurush border-2 border-black"><AlertDialogHeader><AlertDialogTitle className="font-bold">মুছে ফেলবেন?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-black">বাতিল</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(ps.id, 'pdf-sheets')} className="bg-destructive text-white">মুছে ফেলা হয়েছে</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                     </AlertDialog>
                   </div>
                </div>
              </CardHeader>
              <CardFooter className="pt-0 p-4 flex justify-between items-center text-[9px] font-bold text-muted-foreground bg-indigo-50/20 rounded-b-lg">
                <span className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[8px] h-4 font-bold px-1.5 border-black text-indigo-700">{ps.category === 'lecture_sheet' ? 'পিডিএফ নোট' : ps.category === 'creative' ? 'সৃজনশীল পিডিএফ' : ps.category === 'mcq' ? 'MCQ পিডিএফ' : ps.category === 'model_test' ? 'মডেল টেস্ট' : 'উত্তরমালা'}</Badge>
                  <Calendar className="w-3 h-3 ml-2 mr-1" /> {ps.uploadedAt?.toDate ? format(ps.uploadedAt.toDate(), 'dd MMM, yy', { locale: bn }) : ''}
                </span>
                <a href={ps.pdfUrl} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="h-6 text-[9px] font-bold gap-1 border-black text-indigo-700 bg-white"><Download className="w-3 h-3" /> ডাউনলোড</Button></a>
              </CardFooter>
            </Card>
          ))}

          {currentItems.questions.map(q => {
            const isSelected = selectedDocIds.includes(q.id);
            return (
              <Card key={q.id} onClick={() => isSelecting && toggleSelection(q.id)} className={cn("transition-all shadow-sm bg-white border-2 border-black", isSelecting ? "cursor-pointer" : "hover:border-primary", isSelected ? "bg-primary/5" : "border-black")}>
                <CardHeader className="pb-3 p-4">
                  <div className="flex justify-between items-start">
                     <div className="flex items-center gap-3 pr-4 min-w-0">
                       {isSelecting ? (<div className={cn("w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center border-black", isSelected ? "bg-primary border-primary text-white" : "")}>{isSelected && <CheckCircle2 className="w-4 h-4" />}</div>) : (<div className="w-8 h-8 rounded bg-primary/5 flex items-center justify-center text-primary shrink-0"><FileText className="w-4 h-4" /></div>)}
                       <CardTitle className="text-sm font-bold truncate">{q.exam || 'পরীক্ষা'} - {q.chapter || 'অধ্যায় নেই'}</CardTitle>
                     </div>
                     {!isSelecting && (
                       <div className="flex gap-1">
                         <Link href={`/create-question?id=${q.id}`}><Button variant="ghost" size="icon" className="h-7 w-7 text-primary"><Edit className="w-3.5 h-3.5" /></Button></Link>
                         <AlertDialog>
                           <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                           <AlertDialogContent className="font-kalpurush border-2 border-black"><AlertDialogHeader><AlertDialogTitle className="font-bold">মুছে ফেলবেন?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-black">বাতিল</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(q.id, 'questions')} className="bg-destructive text-white">মুছে ফেলা হয়েছে</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                         </AlertDialog>
                       </div>
                     )}
                  </div>
                </CardHeader>
                <CardFooter className="pt-0 p-4 flex justify-between items-center text-[9px] font-bold text-muted-foreground bg-slate-50/50 rounded-b-lg">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[8px] h-4 font-bold px-1.5 border-black">{q.examType === 'model_test' ? 'মডেল টেস্ট' : q.isMcq ? 'এমসিকিউ' : 'সৃজনশীল'}</Badge>
                    <Calendar className="w-3 h-3 ml-2 mr-1" /> {q.updatedAt?.toDate ? format(q.updatedAt.toDate(), 'dd MMM, yy', { locale: bn }) : ''}
                  </span>
                  {!isSelecting && (<Link href={`/create-question?id=${q.id}&print=true`}><Button size="sm" variant="outline" className="h-6 text-[9px] font-bold gap-1 border-black text-primary"><Printer className="w-3 h-3" /> প্রিন্ট</Button></Link>)}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {currentItems.questions.length === 0 && currentItems.sheets.length === 0 && currentItems.pdfSheets.length === 0 && (
          <div className="p-20 text-center border-dashed border-2 border-black bg-muted/5 rounded-2xl"><HelpCircle className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" /><p className="text-muted-foreground font-bold">এই ক্যাটাগরিতে আপনার কোনো সংগ্রহ নেই।</p></div>
        )}
      </section>
    </div>
  );

  if (userLoading || questionsLoading || sheetsLoading || pdfSheetsLoading) return <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /><p className="mt-4 text-muted-foreground font-bold">লাইব্রেরি লোড হচ্ছে...</p></div>;

  if (qError || sError || pError) {
    return (
      <div className="max-w-xl mx-auto p-10 text-center space-y-6 font-kalpurush">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto animate-bounce" />
        <h2 className="text-2xl font-black text-destructive">লাইব্রেরি লোড হতে সমস্যা হয়েছে</h2>
        <p className="text-muted-foreground font-bold">ডাটাবেসে ইনডেক্স প্রয়োজন। নিচের লিঙ্কে ক্লিক করে ইনডেক্স তৈরি করুন।</p>
        <a 
          href="https://console.firebase.google.com/v1/r/project/birganj-pouro-high-schoo-9d39d/firestore/indexes" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg"
        >
          <ExternalLink className="w-5 h-5" /> ফায়ারবেস কনসোল
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-32 font-kalpurush">
      <header className="flex flex-col gap-4 border-b-2 border-black pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm border border-white/20"><LibraryIcon className="w-7 h-7" /></div>
            <div><h2 className="text-2xl font-bold">আমার লাইব্রেরি</h2><p className="text-xs text-muted-foreground font-bold">আপনার সব সংগ্রহ এখানে সুসংগঠিতভাবে সাজানো আছে</p></div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-secondary/20 p-3 rounded-xl border-2 border-black">
          <div className="flex items-center gap-2 text-xs font-bold overflow-x-auto whitespace-nowrap pb-1 text-muted-foreground scrollbar-hide">
            <span className={cn("cursor-pointer hover:text-primary transition-colors px-1", viewMode === 'classes' && "text-primary")} onClick={() => { setViewMode('classes'); setSelectedClass(null); setSelectedSubject(null); setSelectedChapter(null); setIsSelecting(false); setActiveCategory('all'); }}>লাইব্রেরি</span>
            {selectedClass && (<><ChevronRight className="w-3 h-3 shrink-0" /><span className={cn("cursor-pointer hover:text-primary transition-colors px-1", viewMode === 'subjects' && "text-primary")} onClick={() => { setViewMode('subjects'); setSelectedSubject(null); setSelectedChapter(null); setIsSelecting(false); setActiveCategory('all'); }}>{CLASSES.find(c => c.id === selectedClass)?.label} শ্রেণি</span></>)}
            {selectedSubject && (<><ChevronRight className="w-3 h-3 shrink-0" /><span className={cn("cursor-pointer hover:text-primary transition-colors px-1", viewMode === 'chapters' && "text-primary")} onClick={() => { setViewMode('chapters'); setSelectedSubject(null); setSelectedChapter(null); setIsSelecting(false); setActiveCategory('all'); }}>{selectedSubject}</span></>)}
            {selectedChapter && (<><ChevronRight className="w-3 h-3 shrink-0" /><span className={cn("cursor-pointer hover:text-primary transition-colors px-1", viewMode === 'content' && "text-primary")} onClick={() => { setViewMode('content'); }}>{selectedChapter}</span></>)}
          </div>
          <Button variant="outline" size="sm" onClick={handleBack} className="gap-2 font-bold border-black text-primary h-8 self-end sm:self-center bg-white shadow-sm hover:bg-primary hover:text-white transition-all"><ArrowLeft className="w-3.5 h-3.5" /> ফিরে যান</Button>
        </div>
      </header>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">{viewMode === 'classes' && renderClasses()}{viewMode === 'subjects' && renderSubjects()}{viewMode === 'chapters' && renderChapters()}{viewMode === 'content' && renderSubjectContent()}</div>
      {isSelecting && selectedDocIds.length > 0 && (<div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 animate-in slide-in-from-bottom-10"><Card className="bg-primary text-white shadow-2xl border-2 border-black p-4 flex items-center justify-between"><div className="font-bold flex items-center gap-3"><Badge variant="secondary" className="bg-white text-primary font-black border-black">{toBengaliNumber(selectedDocIds.length)} টি</Badge><span>প্রশ্ন সেট সিলেক্ট করা হয়েছে</span></div><Button onClick={handleMergeAndCreate} disabled={merging} className="bg-white text-primary hover:bg-slate-100 font-black shadow-lg border-black">{merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}বোর্ড প্রশ্ন তৈরি করুন</Button></Card></div>)}
    </div>
  );
}

function FilePlus({ className }: { className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 12v6"/></svg>; }

export default function MyLibraryPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>}>
      <MyLibraryContent />
    </Suspense>
  );
}
