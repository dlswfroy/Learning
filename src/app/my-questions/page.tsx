
"use client";

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, deleteDoc, doc, getDocs, documentId } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FileText, 
  Edit, 
  Trash2, 
  Loader2, 
  Calendar, 
  BookOpen, 
  GraduationCap, 
  PlusCircle,
  AlertTriangle,
  Library,
  Book,
  Printer,
  Combine,
  X,
  ListOrdered,
  Eye,
  CheckCircle2,
  BrainCircuit,
  FileQuestion,
  ListChecks
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

// Helper for chapter normalization to group similar names
function normalizeChapter(chapter: string): string {
  if (!chapter) return '';
  const bengaliToEnglish: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  const ordinalMap: Record<string, string> = {
    'প্রথম': '1', 'দ্বিতীয়': '2', 'তৃতীয়': '3', 'চতুর্থ': '4', 'পঞ্চম': '5',
    'ষষ্ঠ': '6', 'সপ্তম': '7', 'অষ্টম': '8', 'নবম': '9', 'দশম': '10'
  };

  let normalized = chapter.toString().toLowerCase().trim();
  
  // Replace ordinals
  Object.entries(ordinalMap).forEach(([bnWord, num]) => {
    if (normalized.includes(bnWord)) normalized = normalized.replace(bnWord, num);
  });

  // Replace Bengali digits
  Object.entries(bengaliToEnglish).forEach(([bn, en]) => {
    normalized = normalized.replace(new RegExp(bn, 'g'), en);
  });

  // Remove common suffixes and words
  normalized = normalized.replace(/(অধ্যায়|অধ্যায়|ম|র্থ|ষ্ঠ|তম|য়|দশ|ঃ)/g, '');
  // Remove spaces
  normalized = normalized.replace(/\s+/g, '');
  
  return normalized;
}

export default function MyLibraryPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterChapter, setFilterChapter] = useState<string>('all');

  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [selectedIndividualQuestions, setSelectedIndividualQuestions] = useState<string[]>([]);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/auth');
    }
  }, [user, userLoading, router]);

  const availableSubjects = useMemo(() => {
    if (filterClassId === 'all') return [];
    return getSubjectsForClass(filterClassId);
  }, [filterClassId]);

  // Reset filters
  useEffect(() => {
    setFilterSubject('all');
    setFilterChapter('all');
  }, [filterClassId]);

  useEffect(() => {
    setFilterChapter('all');
  }, [filterSubject]);

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

  // Dynamically derive chapters from existing questions + predefined list
  const availableChaptersList = useMemo(() => {
    if (!rawQuestions) return [];
    const chaptersSet = new Set<string>();
    
    rawQuestions.forEach(q => {
      if (q.classId === filterClassId && q.subject === filterSubject && q.chapter) {
        chaptersSet.add(q.chapter);
      }
    });

    if (filterClassId !== 'all' && filterSubject !== 'all') {
      getChaptersForSubject(filterClassId, filterSubject).forEach(ch => chaptersSet.add(ch));
    }

    return Array.from(chaptersSet).sort((a, b) => a.localeCompare(b, 'bn', { numeric: true }));
  }, [rawQuestions, filterClassId, filterSubject]);

  const filteredQuestions = useMemo(() => {
    if (!rawQuestions) return [];
    let result = [...rawQuestions];
    if (filterClassId !== 'all') result = result.filter(q => q.classId === filterClassId);
    if (filterSubject !== 'all') result = result.filter(q => q.subject === filterSubject);
    
    if (filterChapter !== 'all') {
      const normTarget = normalizeChapter(filterChapter);
      result = result.filter(q => normalizeChapter(q.chapter || '') === normTarget);
    }
    
    return result.sort((a, b) => {
      const dateA = (a.updatedAt as any)?.toDate?.() || (a.createdAt as any)?.toDate?.() || new Date(0);
      const dateB = (b.updatedAt as any)?.toDate?.() || (b.createdAt as any)?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [rawQuestions, filterClassId, filterSubject, filterChapter]);

  const filteredSheets = useMemo(() => {
    if (!rawSheets) return [];
    let result = [...rawSheets];
    if (filterClassId !== 'all') result = result.filter(s => s.classId === filterClassId);
    if (filterSubject !== 'all') result = result.filter(s => s.subject === filterSubject);
    
    return result.sort((a, b) => {
      const dateA = (a.updatedAt as any)?.toDate?.() || (a.createdAt as any)?.toDate?.() || new Date(0);
      const dateB = (b.updatedAt as any)?.toDate?.() || (b.createdAt as any)?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [rawSheets, filterClassId, filterSubject]);

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

  const handleToggleSetSelect = (id: string) => {
    setSelectedSets(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleOpenMergeDialog = async () => {
    if (selectedSets.length === 0) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "কমপক্ষে ১টি প্রশ্ন সেট সিলেক্ট করুন।" });
      return;
    }
    
    setMergeLoading(true);
    setIsMergeDialogOpen(true);
    
    try {
      const q = query(collection(db!, 'questions'), where(documentId(), 'in', selectedSets));
      const snap = await getDocs(q);
      
      let allQ: any[] = [];
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const qs = (data.questions || []).map((q: any, idx: number) => ({
          ...q,
          id: `${docSnap.id}_${idx}`,
          sourceSetId: docSnap.id,
          sourceSetName: data.chapter || data.exam || 'শিরোনামহীন',
          originalIndex: idx
        }));
        allQ = [...allQ, ...qs];
      });
      
      setAvailableQuestions(allQ);
      setSelectedIndividualQuestions(allQ.map(q => q.id));
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "প্রশ্নগুলো লোড করা সম্ভব হয়নি।" });
    } finally {
      setMergeLoading(false);
    }
  };

  const handleProceedToEdit = () => {
    if (selectedIndividualQuestions.length === 0) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "কমপক্ষে ১টি প্রশ্ন বাছাই করুন।" });
      return;
    }

    const finalQuestions = availableQuestions
      .filter(q => selectedIndividualQuestions.includes(q.id))
      .map(q => ({
        type: q.type,
        imageUrl: q.imageUrl || '',
        stimulus: q.stimulus || '',
        qA: q.qA || '',
        qB: q.qB || '',
        qC: q.qC || '',
        qD: q.qD || '',
        shortText: q.shortText || '',
        mcqQuestion: q.mcqQuestion || '',
        optA: q.optA || '',
        optB: q.optB || '',
        optC: q.optC || '',
        optD: q.optD || ''
      }));

    sessionStorage.setItem('merged_questions_data', JSON.stringify(finalQuestions));
    router.push('/create-question?source=merge');
  };

  const toggleIndividualQuestion = (id: string) => {
    setSelectedIndividualQuestions(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Selection counts by type
  const selectionSummary = useMemo(() => {
    const selected = availableQuestions.filter(q => selectedIndividualQuestions.includes(q.id));
    return {
      creative: selected.filter(q => q.type === 'creative').length,
      short: selected.filter(q => q.type === 'short').length,
      mcq: selected.filter(q => q.type === 'mcq').length,
    };
  }, [availableQuestions, selectedIndividualQuestions]);

  const renderQuestionCard = (q: any) => (
    <Card key={q.id} className={`hover:border-primary/40 transition-all group shadow-sm bg-white relative ${selectedSets.includes(q.id) ? 'border-primary ring-1 ring-primary/20' : ''}`}>
      <div className="absolute top-3 left-3 z-10">
        <Checkbox 
          checked={selectedSets.includes(q.id)} 
          onCheckedChange={() => handleToggleSetSelect(q.id)}
          className="w-5 h-5 bg-white"
        />
      </div>
      <CardHeader className="pb-3 pl-10">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
            {CLASSES.find(c => c.id === q.classId)?.label || 'অজানা'} শ্রেণি
          </Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {q.updatedAt?.toDate ? format(q.updatedAt.toDate(), 'dd MMMM, yyyy', { locale: bn }) : 'অজানা তারিখ'}
          </div>
        </div>
        <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors truncate">
          {q.chapter || q.exam || 'শিরোনাম নেই'}
        </CardTitle>
        <CardDescription className="flex items-center gap-1 font-bold">
          <GraduationCap className="w-3 h-3" /> {q.subject}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4 pl-10">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground truncate font-medium">
            {q.exam || 'পরীক্ষার নাম নেই'}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-bold">
              {q.isMcq ? 'বহুনির্বাচনি' : 'লিখিত'}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-bold">
              মোট প্রশ্ন: {toBengaliNumber(q.questions?.length || 0)} টি
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t bg-muted/10 flex justify-end gap-2 p-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 hover:bg-destructive/10" disabled={deleting === q.id}>
              {deleting === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="font-kalpurush">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 font-bold"><AlertTriangle className="text-destructive w-5 h-5" /> আপনি কি নিশ্চিত?</AlertDialogTitle>
              <AlertDialogDescription className="font-medium">এই প্রশ্নপত্রটি স্থায়ীভাবে মুছে ফেলা হবে।</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(q.id, 'questions')} className="bg-destructive hover:bg-destructive/90 font-bold text-white">হ্যাঁ, মুছে ফেলুন</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Link href={`/create-question?id=${q.id}`}>
          <Button variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary/5 font-bold h-8">
            <Printer className="w-3 h-3" /> প্রিন্ট
          </Button>
        </Link>

        <Link href={`/create-question?id=${q.id}`}>
          <Button variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary/5 font-bold h-8">
            <Edit className="w-3 h-3" /> এডিট
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );

  const renderSheetCard = (s: any) => (
    <Card key={s.id} className="hover:border-orange-400/40 transition-all group shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 font-bold">
            {CLASSES.find(c => c.id === s.classId)?.label || 'অজানা'} শ্রেণি
          </Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {s.updatedAt?.toDate ? format(s.updatedAt.toDate(), 'dd MMMM, yyyy', { locale: bn }) : 'অজানা তারিখ'}
          </div>
        </div>
        <CardTitle className="text-lg font-bold group-hover:text-orange-600 transition-colors truncate">
          {s.topic || 'শিরোনাম নেই'}
        </CardTitle>
        <CardDescription className="flex items-center gap-1 font-bold">
          <BookOpen className="w-3 h-3 text-orange-500" /> {s.subject}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground truncate font-medium">
            {s.institution || 'শিক্ষা প্রতিষ্ঠানের নাম নেই'}
          </p>
          <Badge className="w-fit bg-secondary text-secondary-foreground font-bold text-[10px]">
            {s.type === 'mcq' ? 'বহুনির্বাচনি' : 'লিখিত'}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="border-t bg-muted/10 flex justify-end gap-2 p-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 hover:bg-destructive/10" disabled={deleting === s.id}>
              {deleting === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="font-kalpurush">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 font-bold"><AlertTriangle className="text-destructive w-5 h-5" /> আপনি কি নিশ্চিত?</AlertDialogTitle>
              <AlertDialogDescription className="font-medium">এই লেকচার শিটটি স্থায়ীভাবে মুছে ফেলা হবে।</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(s.id, 'lecture-sheets')} className="bg-destructive hover:bg-destructive/90 font-bold text-white">হ্যাঁ, মুছে ফেলুন</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Link href={`/create-lecture-sheet?id=${s.id}`}>
          <Button variant="outline" size="sm" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-bold h-8">
            <Printer className="w-3 h-3" /> প্রিন্ট
          </Button>
        </Link>

        <Link href={`/create-lecture-sheet?id=${s.id}`}>
          <Button variant="outline" size="sm" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-bold h-8">
            <Edit className="w-3 h-3" /> এডিট
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );

  if (userLoading || questionsLoading || sheetsLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-bold">লাইব্রেরি লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-10 font-kalpurush">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
            <Library className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">আমার লাইব্রেরি</h2>
            <p className="text-xs text-muted-foreground font-bold">অধ্যায় ভিত্তিক প্রশ্ন ও লেকচার শিট সংগ্রহশালা</p>
          </div>
        </div>
        {selectedSets.length > 0 && (
          <div className="flex items-center gap-3 bg-primary/10 px-4 py-2 rounded-xl animate-in fade-in slide-in-from-right-4">
            <span className="text-sm font-bold text-primary">{toBengaliNumber(selectedSets.length)}টি সেট সিলেক্ট করা হয়েছে</span>
            <Button onClick={handleOpenMergeDialog} className="gap-2 font-bold h-9 shadow-md bg-accent hover:bg-accent/90">
              <Combine className="w-4 h-4" /> প্রশ্নপত্র তৈরি করুন
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSelectedSets([])} className="h-8 w-8 text-muted-foreground hover:text-destructive">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-primary/5 p-4 rounded-xl border border-primary/10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-wider">
            <GraduationCap className="w-3 h-3" /> শ্রেণি
          </div>
          <Select value={filterClassId} onValueChange={setFilterClassId}>
            <SelectTrigger className="w-full bg-white font-bold h-9 text-xs">
              <SelectValue placeholder="সব শ্রেণি" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold">সব শ্রেণি</SelectItem>
              {CLASSES.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.label} শ্রেণি</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-wider">
            <Book className="w-3 h-3" /> বিষয়
          </div>
          <Select value={filterSubject} onValueChange={setFilterSubject} disabled={filterClassId === 'all'}>
            <SelectTrigger className="w-full bg-white font-bold h-9 text-xs">
              <SelectValue placeholder={filterClassId === 'all' ? "শ্রেণি নির্বাচন করুন" : "সব বিষয়"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold">সব বিষয়</SelectItem>
              {availableSubjects.map(s => <SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-wider">
            <ListOrdered className="w-3 h-3" /> অধ্যায়
          </div>
          <Select value={filterChapter} onValueChange={setFilterChapter} disabled={filterSubject === 'all'}>
            <SelectTrigger className="w-full bg-white font-bold h-9 text-xs">
              <SelectValue placeholder={filterSubject === 'all' ? "বিষয় নির্বাচন করুন" : "সব অধ্যায়"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold">সব অধ্যায়</SelectItem>
              {availableChaptersList.map(ch => (
                <SelectItem key={ch} value={ch} className="font-bold">{ch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50 p-1 h-14">
          <TabsTrigger value="questions" className="gap-2 font-bold py-3 text-base data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
            <FileText className="w-5 h-5" /> প্রশ্ন ব্যাংক ({toBengaliNumber(filteredQuestions.length)})
          </TabsTrigger>
          <TabsTrigger value="sheets" className="gap-2 font-bold py-3 text-base data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
            <BookOpen className="w-5 h-5" /> লেকচার শিট ({toBengaliNumber(filteredSheets.length)})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="animate-fade-in space-y-4">
          {filteredQuestions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredQuestions.map(renderQuestionCard)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 bg-secondary/5 rounded-3xl border-2 border-dashed border-primary/20 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-bold">কোনো প্রশ্নপত্র পাওয়া যায়নি।</p>
              <Link href="/create-question" className="mt-4"><Button variant="outline" className="gap-2 font-bold border-primary text-primary hover:bg-primary/5"><PlusCircle className="w-4 h-4" /> তৈরি করুন</Button></Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sheets" className="animate-fade-in space-y-4">
          {filteredSheets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSheets.map(renderSheetCard)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 bg-secondary/5 rounded-3xl border-2 border-dashed border-orange-500/20 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-bold">কোনো লেকচার শিট পাওয়া যায়নি।</p>
              <Link href="/create-lecture-sheet" className="mt-4"><Button variant="outline" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-bold"><PlusCircle className="w-4 h-4" /> তৈরি করুন</Button></Link>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col font-kalpurush overflow-hidden p-0">
          <DialogHeader className="p-6 bg-primary/5 border-b sticky top-0 z-10">
            <div className="flex items-center justify-between mb-2">
              <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
                <Combine className="w-6 h-6" /> প্রশ্ন বাছাই করুন
              </DialogTitle>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
                <span className="text-xs font-bold text-muted-foreground">মোট বাছাইকৃত:</span>
                <Badge variant="secondary" className="font-black text-xs">{toBengaliNumber(selectedIndividualQuestions.length)} / {toBengaliNumber(availableQuestions.length)}</Badge>
              </div>
            </div>
            
            {/* Selection Summary Counter */}
            <div className="flex flex-wrap gap-2 md:gap-4 no-print py-2">
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                <BrainCircuit className="w-4 h-4 text-primary" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-primary uppercase">সৃজনশীল</span>
                  <span className="text-sm font-black text-primary leading-none">{toBengaliNumber(selectionSummary.creative)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                <ListChecks className="w-4 h-4 text-accent" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-accent uppercase">সংক্ষিপ্ত</span>
                  <span className="text-sm font-black text-accent leading-none">{toBengaliNumber(selectionSummary.short)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                <FileQuestion className="w-4 h-4 text-orange-600" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-orange-600 uppercase">বহুনির্বাচনি</span>
                  <span className="text-sm font-black text-orange-600 leading-none">{toBengaliNumber(selectionSummary.mcq)}</span>
                </div>
              </div>
              <div className="flex-1" />
              <div className="flex gap-1 self-end">
                <Button size="sm" variant="outline" onClick={() => setSelectedIndividualQuestions(availableQuestions.map(q => q.id))} className="text-[10px] font-bold h-8 gap-1 border-primary/20">
                  <CheckCircle2 className="w-3 h-3" /> সব সিলেক্ট
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedIndividualQuestions([])} className="text-[10px] font-bold h-8 gap-1 border-destructive/20 text-destructive">
                  <X className="w-3 h-3" /> সব মুছুন
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {mergeLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="mt-4 font-bold text-muted-foreground">প্রশ্নগুলো সাজানো হচ্ছে...</p>
              </div>
            ) : availableQuestions.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground font-bold">কোনো প্রশ্ন পাওয়া যায়নি।</div>
            ) : (
              availableQuestions.map((q, idx) => (
                <div 
                  key={q.id} 
                  className={`flex items-start gap-4 p-4 border rounded-2xl transition-all cursor-pointer hover:bg-muted/5 group ${selectedIndividualQuestions.includes(q.id) ? 'border-primary bg-primary/5 ring-1 ring-primary/10' : 'bg-white'}`}
                  onClick={() => toggleIndividualQuestion(q.id)}
                >
                  <Checkbox 
                    checked={selectedIndividualQuestions.includes(q.id)} 
                    onCheckedChange={() => toggleIndividualQuestion(q.id)}
                    className="w-5 h-5 mt-1 pointer-events-none"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-primary">{toBengaliNumber(idx + 1)}.</span>
                        <Badge variant="outline" className="text-[10px] bg-white font-bold">{q.sourceSetName}</Badge>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${q.type === 'mcq' ? 'bg-orange-100 text-orange-600' : q.type === 'short' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                          {q.type === 'mcq' ? 'বহুনির্বাচনি' : q.type === 'short' ? 'সংক্ষিপ্ত' : 'সৃজনশীল'}
                        </span>
                      </div>
                      {q.imageUrl && <Badge variant="secondary" className="text-[8px] font-bold gap-1"><Eye className="w-2.5 h-2.5" /> চিত্রযুক্ত</Badge>}
                    </div>
                    <div className="text-sm font-medium line-clamp-3 leading-relaxed">
                      {q.type === 'mcq' ? q.mcqQuestion : q.type === 'creative' ? q.stimulus : q.shortText}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t sticky bottom-0 z-10">
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)} className="font-bold">বাতিল</Button>
            <Button 
              onClick={handleProceedToEdit} 
              disabled={selectedIndividualQuestions.length === 0}
              className="font-bold bg-accent hover:bg-accent/90 gap-2 px-8 shadow-md"
            >
              <Edit className="w-4 h-4" /> এডিট ও সাজান
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}
