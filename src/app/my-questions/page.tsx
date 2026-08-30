
"use client";

import { useMemo, useState, useEffect } from 'react';
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
  ListChecks,
  ArrowLeft,
  CheckCircle2,
  X,
  PlusCircle,
  FilePlus,
  HelpCircle,
  Layers
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
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

type ViewMode = 'classes' | 'subjects' | 'chapters' | 'content';

export default function MyLibraryPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  // Selection states
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  useEffect(() => { if (!userLoading && !user) router.push('/auth'); }, [user, userLoading, router]);

  const questionsQuery = useMemo(() => db && user ? query(collection(db, 'questions'), where('userId', '==', user.uid)) : null, [db, user]);
  const sheetsQuery = useMemo(() => db && user ? query(collection(db, 'lecture-sheets'), where('userId', '==', user.uid)) : null, [db, user]);

  const { data: rawQuestions, loading: questionsLoading } = useCollection(questionsQuery);
  const { data: rawSheets, loading: sheetsLoading } = useCollection(sheetsQuery);

  const libraryData = useMemo(() => ({ questions: rawQuestions || [], sheets: rawSheets || [] }), [rawQuestions, rawSheets]);

  // Dynamically calculate subjects that have data OR are in constants
  const currentSubjects = useMemo(() => {
    if (!selectedClass) return [];
    const predefined = getSubjectsForClass(selectedClass);
    const fromDb = [
      ...libraryData.questions.filter(q => q.classId === selectedClass).map(q => q.subject),
      ...libraryData.sheets.filter(s => s.classId === selectedClass).map(s => s.subject)
    ].filter(Boolean) as string[];
    
    // Combine unique subjects
    return Array.from(new Set([...predefined, ...fromDb])).sort((a, b) => a.localeCompare(b, 'bn'));
  }, [selectedClass, libraryData]);

  // Dynamically calculate chapters that have data OR are in constants
  const currentChapters = useMemo(() => {
    if (!selectedClass || !selectedSubject) return [];
    const predefined = getChaptersForSubject(selectedClass, selectedSubject);
    const fromDb = [
      ...libraryData.questions
        .filter(q => q.classId === selectedClass && q.subject === selectedSubject)
        .map(q => q.chapter),
      ...libraryData.sheets
        .filter(s => s.classId === selectedClass && s.subject === selectedSubject)
        .map(s => s.topic)
    ].filter(Boolean) as string[];

    const combined = Array.from(new Set([...predefined, ...fromDb])).sort((a, b) => a.localeCompare(b, 'bn'));
    return combined.length > 0 ? combined : ['সাধারণ অধ্যায়'];
  }, [selectedClass, selectedSubject, libraryData]);

  const currentItems = useMemo(() => {
    let qs = libraryData.questions;
    let ss = libraryData.sheets;
    if (selectedClass) { qs = qs.filter(q => q.classId === selectedClass); ss = ss.filter(s => s.classId === selectedClass); }
    if (selectedSubject) { qs = qs.filter(q => q.subject === selectedSubject); ss = ss.filter(s => s.subject === selectedSubject); }
    if (selectedChapter) { 
      // Filter by the specific chapter/topic name
      // Handle the "General/Default" folder fallback if necessary
      qs = qs.filter(q => (q.chapter === selectedChapter) || (!q.chapter && selectedChapter === 'সাধারণ অধ্যায়'));
      ss = ss.filter(s => (s.topic === selectedChapter) || (!s.topic && selectedChapter === 'সাধারণ অধ্যায়'));
    }
    return { questions: qs, sheets: ss };
  }, [libraryData, selectedClass, selectedSubject, selectedChapter]);

  const toggleSelection = (id: string) => {
    if (!isSelecting) return;
    setSelectedDocIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleMergeAndCreate = async () => {
    if (selectedDocIds.length < 1) return;
    setMerging(true);
    try {
      const mergedQuestions: any[] = [];
      const promises = selectedDocIds.map(id => getDocs(query(collection(db!, 'questions'), where('userId', '==', user!.uid))));
      const results = await Promise.all(promises);
      
      results.forEach(snap => {
        snap.docs.forEach(doc => {
          if (selectedDocIds.includes(doc.id)) {
            const data = doc.data();
            if (data.questions) mergedQuestions.push(...data.questions);
          }
        });
      });

      if (mergedQuestions.length === 0) {
        toast({ variant: "destructive", title: "ত্রুটি", description: "কোনো প্রশ্ন পাওয়া যায়নি।" });
        return;
      }

      sessionStorage.setItem('merged_questions_data', JSON.stringify(mergedQuestions));
      router.push('/create-question?source=merge');
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "প্রশ্ন একত্রীকরণ ব্যর্থ হয়েছে।" });
    } finally {
      setMerging(false);
    }
  };

  const handleDelete = async (id: string, type: 'questions' | 'lecture-sheets') => {
    try {
      await deleteDoc(doc(db!, type, id));
      toast({ title: "সফল", description: "আইটেমটি মুছে ফেলা হয়েছে।" });
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "মুছে ফেলা সম্ভব হয়নি।" });
    }
  };

  const renderClasses = () => {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {CLASSES.map(cls => (
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
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {currentSubjects.map(sub => (
          <Card key={sub} onClick={() => { setSelectedSubject(sub); setViewMode('chapters'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2">
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
  };

  const renderChapters = () => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {currentChapters.map(ch => (
          <Card key={ch} onClick={() => { setSelectedChapter(ch); setViewMode('content'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2 bg-slate-50/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Layers className="w-5 h-5" />
              </div>
              <p className="font-bold text-xs flex-1 line-clamp-2">{ch}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderSubjectContent = () => {
    return (
      <div className="space-y-10">
        {/* Creation Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-black text-primary flex items-center gap-2 border-b pb-2 uppercase tracking-wider">
            <PlusCircle className="w-4 h-4" /> নতুন তৈরি করুন ({selectedChapter})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href={`/create-lecture-sheet?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&topic=${encodeURIComponent(selectedChapter || '')}`}>
              <Card className="hover:border-orange-500 hover:shadow-lg transition-all group border-l-4 border-l-orange-500 cursor-pointer bg-orange-50/30">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <FilePlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-orange-700">লেকচার শিট</h4>
                    <p className="text-[10px] font-bold text-muted-foreground">এই অধ্যায়ের নোট তৈরি করুন</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Dialog>
              <DialogTrigger asChild>
                <Card className="hover:border-primary hover:shadow-lg transition-all group border-l-4 border-l-primary cursor-pointer bg-blue-50/30">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                      <BrainCircuit className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-primary">প্রশ্নপত্র</h4>
                      <p className="text-[10px] font-bold text-muted-foreground">এই অধ্যায়ের প্রশ্ন তৈরি করুন</p>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="font-kalpurush">
                <DialogHeader>
                  <DialogTitle className="font-black text-primary text-xl">প্রশ্নের ধরন নির্বাচন করুন</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-3 py-4">
                  <Button variant="outline" className="h-14 font-bold gap-3 justify-start px-6" onClick={() => router.push(`/create-question?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&chapter=${encodeURIComponent(selectedChapter || '')}&type=creative`)}>
                    <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center"><FileText className="w-4 h-4" /></div>
                    সৃজনশীল প্রশ্নপত্র
                  </Button>
                  <Button variant="outline" className="h-14 font-bold gap-3 justify-start px-6" onClick={() => router.push(`/create-question?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&chapter=${encodeURIComponent(selectedChapter || '')}&type=mcq`)}>
                    <div className="w-8 h-8 rounded bg-orange-100 text-orange-600 flex items-center justify-center"><ListChecks className="w-4 h-4" /></div>
                    বহুনির্বাচনি (MCQ) প্রশ্নপত্র
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* Existing Items Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2 uppercase tracking-wider">
              <Folder className="w-4 h-4" /> আমার সংগ্রহ ({toBengaliNumber(currentItems.questions.length + currentItems.sheets.length)})
            </h3>
            {currentItems.questions.length > 0 && (
              <Button 
                variant={isSelecting ? "destructive" : "outline"} 
                size="sm" 
                onClick={() => { setIsSelecting(!isSelecting); setSelectedDocIds([]); }}
                className="h-8 gap-2 font-bold text-xs"
              >
                {isSelecting ? <X className="w-3.5 h-3.5" /> : <ListChecks className="w-3.5 h-3.5" />}
                {isSelecting ? "বাতিল" : "প্রশ্ন বাছাই করুন"}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sheets */}
            {currentItems.sheets.map(s => (
              <Card key={s.id} className="hover:border-orange-400/40 transition-all shadow-sm bg-white border-2">
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
                <CardFooter className="pt-0 p-4 flex justify-between items-center text-[9px] font-bold text-muted-foreground bg-slate-50/50 rounded-b-lg">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {s.updatedAt?.toDate ? format(s.updatedAt.toDate(), 'dd MMM, yy', { locale: bn }) : ''}</span>
                  <Link href={`/create-lecture-sheet?id=${s.id}&print=true`}><Button size="sm" variant="outline" className="h-6 text-[9px] font-bold gap-1 border-orange-500 text-orange-600"><Printer className="w-3 h-3" /> প্রিন্ট</Button></Link>
                </CardFooter>
              </Card>
            ))}

            {/* Questions */}
            {currentItems.questions.map(q => {
              const isSelected = selectedDocIds.includes(q.id);
              return (
                <Card 
                  key={q.id} 
                  onClick={() => isSelecting && toggleSelection(q.id)}
                  className={cn(
                    "transition-all shadow-sm bg-white border-2",
                    isSelecting ? "cursor-pointer" : "hover:border-primary/40",
                    isSelected ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <CardHeader className="pb-3 p-4">
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-3 pr-4 min-w-0">
                         {isSelecting ? (
                           <div className={cn("w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center", isSelected ? "bg-primary border-primary text-white" : "border-muted-foreground/30")}>
                             {isSelected && <CheckCircle2 className="w-4 h-4" />}
                           </div>
                         ) : (
                           <div className="w-8 h-8 rounded bg-primary/5 flex items-center justify-center text-primary shrink-0"><FileText className="w-4 h-4" /></div>
                         )}
                         <CardTitle className="text-sm font-bold truncate">
                           {q.exam || 'পরীক্ষা'} - {q.chapter || 'অধ্যায় নেই'}
                         </CardTitle>
                       </div>
                       {!isSelecting && (
                         <div className="flex gap-1">
                           <Link href={`/create-question?id=${q.id}`}><Button variant="ghost" size="icon" className="h-7 w-7 text-primary"><Edit className="w-3.5 h-3.5" /></Button></Link>
                           <AlertDialog>
                             <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                             <AlertDialogContent className="font-kalpurush">
                               <AlertDialogHeader><AlertDialogTitle className="font-bold">মুছে ফেলবেন?</AlertDialogTitle></AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                 <AlertDialogAction onClick={() => handleDelete(q.id, 'questions')} className="bg-destructive text-white">মুছে ফেলুন</AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                         </div>
                       )}
                    </div>
                  </CardHeader>
                  <CardFooter className="pt-0 p-4 flex justify-between items-center text-[9px] font-bold text-muted-foreground bg-slate-50/50 rounded-b-lg">
                    <span className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[8px] h-4 font-bold px-1.5">{q.isMcq ? 'এমসিকিউ' : 'সৃজনশীল'}</Badge>
                      <Calendar className="w-3 h-3 ml-1" /> {q.updatedAt?.toDate ? format(q.updatedAt.toDate(), 'dd MMM, yy', { locale: bn }) : ''}
                    </span>
                    {!isSelecting && (
                      <Link href={`/create-question?id=${q.id}&print=true`}><Button size="sm" variant="outline" className="h-6 text-[9px] font-bold gap-1 border-primary text-primary"><Printer className="w-3 h-3" /> প্রিন্ট</Button></Link>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {currentItems.questions.length === 0 && currentItems.sheets.length === 0 && (
            <div className="p-20 text-center border-dashed border-2 bg-muted/5 rounded-2xl">
              <HelpCircle className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground font-bold">এই অধ্যায়ে আপনার কোনো সংগ্রহ নেই।</p>
            </div>
          )}
        </section>
      </div>
    );
  };

  const handleBack = () => {
    if (isSelecting) { setIsSelecting(false); setSelectedDocIds([]); return; }
    if (viewMode === 'content') { setViewMode('chapters'); setSelectedChapter(null); return; }
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
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-32 font-kalpurush">
      <header className="flex flex-col gap-4 border-b pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
              <LibraryIcon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">আমার লাইব্রেরি</h2>
              <p className="text-xs text-muted-foreground font-bold">আপনার সব সংগ্রহ এখানে সুসংগঠিতভাবে সাজানো আছে</p>
            </div>
          </div>
          <div className="flex gap-2">
            {viewMode !== 'classes' && (
              <Button variant="outline" size="sm" onClick={handleBack} className="gap-2 font-bold border-primary text-primary">
                <ArrowLeft className="w-4 h-4" /> ফিরে যান
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold overflow-x-auto whitespace-nowrap pb-2 text-muted-foreground">
          <span className={cn("cursor-pointer hover:text-primary", viewMode === 'classes' && "text-primary")} onClick={() => { setViewMode('classes'); setSelectedClass(null); setSelectedSubject(null); setSelectedChapter(null); setIsSelecting(false); }}>লাইব্রেরি</span>
          {selectedClass && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className={cn("cursor-pointer hover:text-primary", viewMode === 'subjects' && "text-primary")} onClick={() => { setViewMode('subjects'); setSelectedSubject(null); setSelectedChapter(null); setIsSelecting(false); }}>{CLASSES.find(c => c.id === selectedClass)?.label} শ্রেণি</span>
            </>
          )}
          {selectedSubject && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className={cn("cursor-pointer hover:text-primary", viewMode === 'chapters' && "text-primary")} onClick={() => { setViewMode('chapters'); setSelectedChapter(null); }}>{selectedSubject}</span>
            </>
          )}
          {selectedChapter && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className={cn("cursor-pointer hover:text-primary", viewMode === 'content' && "text-primary")} onClick={() => { setViewMode('content'); }}>{selectedChapter}</span>
            </>
          )}
        </div>
      </header>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        {viewMode === 'classes' && renderClasses()}
        {viewMode === 'subjects' && renderSubjects()}
        {viewMode === 'chapters' && renderChapters()}
        {viewMode === 'content' && renderSubjectContent()}
      </div>

      {isSelecting && selectedDocIds.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 animate-in slide-in-from-bottom-10">
          <Card className="bg-primary text-white shadow-2xl border-none p-4 flex items-center justify-between">
            <div className="font-bold flex items-center gap-3">
              <Badge variant="secondary" className="bg-white text-primary font-black">
                {toBengaliNumber(selectedDocIds.length)} টি
              </Badge>
              <span>প্রশ্ন সেট সিলেক্ট করা হয়েছে</span>
            </div>
            <Button 
              onClick={handleMergeAndCreate} 
              disabled={merging}
              className="bg-white text-primary hover:bg-slate-100 font-black shadow-lg"
            >
              {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
              বোর্ড প্রশ্ন তৈরি করুন
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
