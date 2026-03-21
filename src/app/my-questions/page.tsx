
"use client";

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, deleteDoc, doc } from 'firebase/firestore';
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
  AlertTriangle,
  Library,
  Book,
  Printer,
  ChevronRight,
  Folder,
  FolderOpen,
  ArrowLeft,
  Search,
  BrainCircuit,
  ListChecks,
  CheckCircle2,
  X
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { CLASSES } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Improved helper for chapter normalization to group similar names (Strong Partial Match Logic)
function getChapterGroupKey(chapter: string): string {
  if (!chapter) return 'শিরোনামহীন';
  
  const bengaliToEnglish: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  
  const ordinalMap: Record<string, string> = {
    'প্রথম': '1', 'দ্বিতীয়': '2', 'তৃতীয়': '3', 'চতুর্থ': '4', 'পঞ্চম': '5',
    'ষষ্ঠ': '6', 'সপ্তম': '7', 'অষ্টম': '8', 'নবম': '9', 'দশম': '10'
  };

  let normalized = chapter.toString().toLowerCase().trim();
  
  // Replace ordinal words with numbers
  Object.entries(ordinalMap).forEach(([bnWord, num]) => {
    if (normalized.includes(bnWord)) normalized = normalized.replace(new RegExp(bnWord, 'g'), num);
  });
  
  // Replace Bengali digits with English digits
  Object.entries(bengaliToEnglish).forEach(([bn, en]) => {
    normalized = normalized.replace(new RegExp(bn, 'g'), en);
  });
  
  // Remove common structural words and characters
  normalized = normalized.replace(/(অধ্যায়|অধ্যায়|ম|র্থ|ষ্ঠ|তম|য়|দশ|ঃ|:|\.)/g, '');
  
  // Strip all non-alphanumeric/bengali characters and spaces
  return normalized.replace(/\s+/g, '').trim() || 'শিরোনামহীন';
}

type ViewMode = 'classes' | 'subjects' | 'chapters' | 'types' | 'content';

export default function MyLibraryPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'questions' | 'sheets' | null>(null);
  const [selectedSubType, setSelectedSubType] = useState<'creative' | 'mcq' | 'all' | null>(null);

  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && !user) router.push('/auth');
  }, [user, userLoading, router]);

  const questionsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, 'questions'), where('userId', '==', user.uid));
  }, [db, user]);

  const sheetsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, 'lecture-sheets'), where('userId', '==', user.uid));
  }, [db, user]);

  const { data: rawQuestions, loading: questionsLoading } = useCollection(questionsQuery);
  const { data: rawSheets, loading: sheetsLoading } = useCollection(sheetsQuery);

  const libraryData = useMemo(() => {
    return {
      questions: rawQuestions || [],
      sheets: rawSheets || []
    };
  }, [rawQuestions, rawSheets]);

  const handleDelete = async (id: string, type: 'questions' | 'lecture-sheets') => {
    setDeleting(id);
    try {
      await deleteDoc(doc(db!, type, id));
      toast({ title: "সফল", description: "আইটেমটি মুছে ফেলা হয়েছে।" });
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "মুছে ফেলা সম্ভব হয়নি।" });
    } finally {
      setDeleting(null);
    }
  };

  const currentItems = useMemo(() => {
    let qs = libraryData.questions;
    let ss = libraryData.sheets;

    if (selectedClass) {
      qs = qs.filter(q => q.classId === selectedClass);
      ss = ss.filter(s => s.classId === selectedClass);
    }

    if (selectedSubject) {
      qs = qs.filter(q => q.subject === selectedSubject);
      ss = ss.filter(s => s.subject === selectedSubject);
    }

    if (selectedChapter) {
      const targetKey = selectedChapter;
      qs = qs.filter(q => getChapterGroupKey(q.chapter || '') === targetKey);
      ss = ss.filter(s => getChapterGroupKey(s.topic || '') === targetKey);
    }

    return { questions: qs, sheets: ss };
  }, [libraryData, selectedClass, selectedSubject, selectedChapter]);

  const renderClasses = () => {
    const classIds = Array.from(new Set([...libraryData.questions.map(q => q.classId), ...libraryData.sheets.map(s => s.classId)]));
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {CLASSES.filter(c => classIds.includes(c.id)).map(cls => (
          <Card key={cls.id} onClick={() => { setSelectedClass(cls.id); setViewMode('subjects'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2">
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
  };

  const renderSubjects = () => {
    const subjects = Array.from(new Set([...currentItems.questions.map(q => q.subject), ...currentItems.sheets.map(s => s.subject)]));
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {subjects.map(sub => (
          <Card key={sub} onClick={() => { setSelectedSubject(sub); setViewMode('chapters'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-all">
                <Book className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderChapters = () => {
    const chapterMap = new Map<string, string>();
    
    // Group everything by the normalized key
    currentItems.questions.forEach(q => {
      const key = getChapterGroupKey(q.chapter || '');
      if (!chapterMap.has(key)) {
        chapterMap.set(key, q.chapter || 'শিরোনামহীন');
      }
    });
    
    currentItems.sheets.forEach(s => {
      const key = getChapterGroupKey(s.topic || '');
      if (!chapterMap.has(key)) {
        chapterMap.set(key, s.topic || 'শিরোনামহীন');
      }
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from(chapterMap.entries()).map(([key, label]) => (
          <Card key={key} onClick={() => { setSelectedChapter(key); setViewMode('types'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all">
                <Folder className="w-5 h-5" />
              </div>
              <p className="font-bold text-sm truncate flex-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderTypes = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card onClick={() => { setSelectedType('questions'); setViewMode('content'); }} className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group border-l-4 border-l-primary">
        <CardContent className="p-8 flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
            <BrainCircuit className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-primary">নমুনা প্রশ্ন</h3>
            <p className="text-xs text-muted-foreground font-bold">সৃজনশীল ও বহুনির্বাচনি প্রশ্ন ব্যাংক</p>
          </div>
        </CardContent>
      </Card>
      <Card onClick={() => { setSelectedType('sheets'); setViewMode('content'); }} className="cursor-pointer hover:border-orange-500 hover:shadow-lg transition-all group border-l-4 border-l-orange-500">
        <CardContent className="p-8 flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-all">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-orange-600">লেকচার শিট</h3>
            <p className="text-xs text-muted-foreground font-bold">অধ্যায় ভিত্তিক লেকচার নোট</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFiles = () => {
    if (selectedType === 'sheets') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentItems.sheets.map(s => (
            <Card key={s.id} className="hover:border-orange-400/40 transition-all shadow-sm bg-white">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                   <CardTitle className="text-base font-bold truncate pr-4">{s.topic}</CardTitle>
                   <div className="flex gap-2">
                     <Link href={`/create-lecture-sheet?id=${s.id}`}><Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Edit className="w-4 h-4" /></Button></Link>
                     <AlertDialog>
                       <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                       <AlertDialogContent className="font-kalpurush">
                         <AlertDialogHeader><AlertDialogTitle className="font-bold">মুছে ফেলবেন?</AlertDialogTitle></AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>বাতিল</AlertDialogCancel>
                           <AlertDialogAction onClick={() => handleDelete(s.id, 'lecture-sheets')} className="bg-destructive text-white">মুছে ফেলুন</AlertDialogAction>
                         </AlertDialogFooter>
                       </AlertDialogContent>
                     </AlertDialog>
                   </div>
                </div>
              </CardHeader>
              <CardFooter className="pt-0 flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {s.updatedAt?.toDate ? format(s.updatedAt.toDate(), 'dd MMM, yy', { locale: bn }) : ''}</span>
                <Link href={`/create-lecture-sheet?id=${s.id}&print=true`}><Button size="sm" variant="outline" className="h-7 text-[10px] font-bold gap-1 border-orange-500 text-orange-600"><Printer className="w-3 h-3" /> প্রিন্ট</Button></Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      );
    }

    if (!selectedSubType) {
      const cqCount = currentItems.questions.filter(q => !q.isMcq).length;
      const mcqCount = currentItems.questions.filter(q => q.isMcq).length;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card onClick={() => setSelectedSubType('creative')} className="cursor-pointer hover:border-primary border-2 p-6 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all"><FileText className="w-5 h-5" /></div>
              <span className="font-bold">সৃজনশীল প্রশ্ন</span>
            </div>
            <Badge className="font-bold bg-primary/10 text-primary">{toBengaliNumber(cqCount)} টি</Badge>
          </Card>
          <Card onClick={() => setSelectedSubType('mcq')} className="cursor-pointer hover:border-orange-500 border-2 p-6 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-all"><ListChecks className="w-5 h-5" /></div>
              <span className="font-bold">বহুনির্বাচনি প্রশ্ন</span>
            </div>
            <Badge className="font-bold bg-orange-500/10 text-orange-600">{toBengaliNumber(mcqCount)} টি</Badge>
          </Card>
        </div>
      );
    }

    const filteredQs = currentItems.questions.filter(q => selectedSubType === 'creative' ? !q.isMcq : q.isMcq);
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredQs.map(q => (
          <Card key={q.id} className="hover:border-primary/40 transition-all shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                 <CardTitle className="text-base font-bold truncate pr-4">{q.chapter || q.exam}</CardTitle>
                 <div className="flex gap-2">
                   <Link href={`/create-question?id=${q.id}`}><Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Edit className="w-4 h-4" /></Button></Link>
                   <AlertDialog>
                     <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                     <AlertDialogContent className="font-kalpurush">
                       <AlertDialogHeader><AlertDialogTitle className="font-bold">মুছে ফেলবেন?</AlertDialogTitle></AlertDialogHeader>
                       <AlertDialogFooter>
                         <AlertDialogCancel>বাতিল</AlertDialogCancel>
                         <AlertDialogAction onClick={() => handleDelete(q.id, 'questions')} className="bg-destructive text-white">মুছে ফেলুন</AlertDialogAction>
                       </AlertDialogFooter>
                     </AlertDialogContent>
                   </AlertDialog>
                 </div>
              </div>
            </CardHeader>
            <CardFooter className="pt-0 flex justify-between items-center text-[10px] font-bold text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {q.updatedAt?.toDate ? format(q.updatedAt.toDate(), 'dd MMM, yy', { locale: bn }) : ''}</span>
              <Link href={`/create-question?id=${q.id}&print=true`}><Button size="sm" variant="outline" className="h-7 text-[10px] font-bold gap-1 border-primary text-primary"><Printer className="w-3 h-3" /> প্রিন্ট</Button></Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  const handleBack = () => {
    if (selectedSubType) { setSelectedSubType(null); return; }
    if (viewMode === 'content') { setViewMode('types'); setSelectedType(null); return; }
    if (viewMode === 'types') { setViewMode('chapters'); setSelectedChapter(null); return; }
    if (viewMode === 'chapters') { setViewMode('subjects'); setSelectedSubject(null); return; }
    if (viewMode === 'subjects') { setViewMode('classes'); setSelectedClass(null); return; }
  };

  if (userLoading || questionsLoading || sheetsLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-bold">লাইব্রেরি লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20 font-kalpurush">
      <header className="flex flex-col gap-4 border-b pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
              <Library className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">আমার লাইব্রেরি</h2>
              <p className="text-xs text-muted-foreground font-bold">আপনার সব সংগ্রহ এখানে ফোল্ডার আকারে সাজানো আছে</p>
            </div>
          </div>
          {viewMode !== 'classes' && (
            <Button variant="outline" size="sm" onClick={handleBack} className="gap-2 font-bold border-primary text-primary">
              <ArrowLeft className="w-4 h-4" /> ফিরে যান
            </Button>
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-bold overflow-x-auto whitespace-nowrap pb-2 text-muted-foreground">
          <span className={cn("cursor-pointer hover:text-primary", viewMode === 'classes' && "text-primary")} onClick={() => { setViewMode('classes'); setSelectedClass(null); setSelectedSubject(null); setSelectedChapter(null); setSelectedType(null); setSelectedSubType(null); }}>লাইব্রেরি</span>
          {selectedClass && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className={cn("cursor-pointer hover:text-primary", viewMode === 'subjects' && "text-primary")} onClick={() => { setViewMode('subjects'); setSelectedSubject(null); setSelectedChapter(null); setSelectedType(null); setSelectedSubType(null); }}>{CLASSES.find(c => c.id === selectedClass)?.label} শ্রেণি</span>
            </>
          )}
          {selectedSubject && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className={cn("cursor-pointer hover:text-primary", viewMode === 'chapters' && "text-primary")} onClick={() => { setViewMode('chapters'); setSelectedSubject(null); setSelectedChapter(null); setSelectedType(null); setSelectedSubType(null); }}>{selectedSubject}</span>
            </>
          )}
          {selectedChapter && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className={cn("cursor-pointer hover:text-primary", viewMode === 'types' && "text-primary")} onClick={() => { setViewMode('chapters'); setSelectedChapter(null); setSelectedType(null); setSelectedSubType(null); }}>অধ্যায় / টপিক</span>
            </>
          )}
          {selectedType && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className={cn("cursor-pointer hover:text-primary", !selectedSubType && "text-primary")} onClick={() => { setViewMode('content'); setSelectedSubType(null); }}>{selectedType === 'questions' ? 'নমুনা প্রশ্ন' : 'লেকচার শিট'}</span>
            </>
          )}
          {selectedSubType && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="text-primary">{selectedSubType === 'creative' ? 'সৃজনশীল' : 'বহুনির্বাচনি'}</span>
            </>
          )}
        </div>
      </header>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        {viewMode === 'classes' && renderClasses()}
        {viewMode === 'subjects' && renderSubjects()}
        {viewMode === 'chapters' && renderChapters()}
        {viewMode === 'types' && renderTypes()}
        {viewMode === 'content' && renderFiles()}
      </div>

      {(viewMode === 'content' || viewMode === 'types') && (
        <div className="flex justify-center pt-10">
           <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
             <Library className="w-3 h-3" /> মোট আইটেম: {toBengaliNumber((currentItems.questions.length + currentItems.sheets.length))} টি
           </p>
        </div>
      )}
    </div>
  );
}

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}
