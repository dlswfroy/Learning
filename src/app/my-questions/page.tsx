
"use client";

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, deleteDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Filter,
  Library,
  Book,
  ClipboardList
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
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function MyLibraryPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Filtering states
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/auth');
    }
  }, [user, userLoading, router]);

  // Available subjects based on selected class
  const availableSubjects = useMemo(() => {
    if (filterClassId === 'all') return [];
    return getSubjectsForClass(filterClassId);
  }, [filterClassId]);

  // Reset subject filter when class changes
  useEffect(() => {
    setFilterSubject('all');
  }, [filterClassId]);

  // Query for Questions
  const questionsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'questions'),
      where('userId', '==', user.uid)
    );
  }, [db, user]);

  // Query for Lecture Sheets
  const sheetsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'lecture-sheets'),
      where('userId', '==', user.uid)
    );
  }, [db, user]);

  const { data: rawQuestions, loading: questionsLoading } = useCollection(questionsQuery);
  const { data: rawSheets, loading: sheetsLoading } = useCollection(sheetsQuery);

  const sortedQuestions = useMemo(() => {
    if (!rawQuestions) return [];
    return [...rawQuestions].sort((a, b) => {
      const dateA = (a.updatedAt as any)?.toDate?.() || (a.createdAt as any)?.toDate?.() || new Date(0);
      const dateB = (b.updatedAt as any)?.toDate?.() || (b.createdAt as any)?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [rawQuestions]);

  const sortedSheets = useMemo(() => {
    if (!rawSheets) return [];
    return [...rawSheets].sort((a, b) => {
      const dateA = (a.updatedAt as any)?.toDate?.() || (a.createdAt as any)?.toDate?.() || new Date(0);
      const dateB = (b.updatedAt as any)?.toDate?.() || (b.createdAt as any)?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [rawSheets]);

  const filteredQuestions = useMemo(() => {
    let result = sortedQuestions;
    if (filterClassId !== 'all') {
      result = result.filter(q => q.classId === filterClassId);
    }
    if (filterSubject !== 'all') {
      result = result.filter(q => q.subject === filterSubject);
    }
    return result;
  }, [sortedQuestions, filterClassId, filterSubject]);

  const filteredSheets = useMemo(() => {
    let result = sortedSheets;
    if (filterClassId !== 'all') {
      result = result.filter(s => s.classId === filterClassId);
    }
    if (filterSubject !== 'all') {
      result = result.filter(s => s.subject === filterSubject);
    }
    return result;
  }, [sortedSheets, filterClassId, filterSubject]);

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

  const renderQuestionCard = (q: any) => (
    <Card key={q.id} className="hover:border-primary/40 transition-all group shadow-sm bg-white">
      <CardHeader className="pb-3">
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
          {q.exam || 'পরীক্ষার নাম নেই'}
        </CardTitle>
        <CardDescription className="flex items-center gap-1 font-bold">
          <GraduationCap className="w-3 h-3" /> {q.subject}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground truncate font-medium">
            {q.institution || 'শিক্ষা প্রতিষ্ঠানের নাম নেই'}
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
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:bg-destructive/10"
              disabled={deleting === q.id}
            >
              {deleting === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 font-bold">
                <AlertTriangle className="text-destructive w-5 h-5" /> আপনি কি নিশ্চিত?
              </AlertDialogTitle>
              <AlertDialogDescription className="font-medium">
                এই প্রশ্নপত্রটি স্থায়ীভাবে মুছে ফেলা হবে।
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleDelete(q.id, 'questions')}
                className="bg-destructive hover:bg-destructive/90 font-bold text-white"
              >
                হ্যাঁ, মুছে ফেলুন
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Link href={`/create-question?id=${q.id}`}>
          <Button variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary/5 font-bold">
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
            {s.content?.includes('ক.') || s.content?.includes('১.') ? 'লিখিত' : 'বহুনির্বাচনি'}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="border-t bg-muted/10 flex justify-end gap-2 p-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:bg-destructive/10"
              disabled={deleting === s.id}
            >
              {deleting === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 font-bold">
                <AlertTriangle className="text-destructive w-5 h-5" /> আপনি কি নিশ্চিত?
              </AlertDialogTitle>
              <AlertDialogDescription className="font-medium">
                এই লেকচার শিটটি স্থায়ীভাবে মুছে ফেলা হবে।
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleDelete(s.id, 'lecture-sheets')}
                className="bg-destructive hover:bg-destructive/90 font-bold text-white"
              >
                হ্যাঁ, মুছে ফেলুন
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Link href={`/create-lecture-sheet?id=${s.id}`}>
          <Button variant="outline" size="sm" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-bold">
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

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
            <Library className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">আমার লাইব্রেরি</h2>
            <p className="text-xs text-muted-foreground font-bold">আপনার তৈরি করা সকল প্রশ্ন ও শিট এখানে পাবেন</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-primary/5 p-4 rounded-xl border border-primary/10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <GraduationCap className="w-4 h-4" /> শ্রেণি অনুযায়ী ফিল্টার:
          </div>
          <Select value={filterClassId} onValueChange={setFilterClassId}>
            <SelectTrigger className="w-full bg-white font-bold">
              <SelectValue placeholder="সব শ্রেণি" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold">সব শ্রেণি</SelectItem>
              {CLASSES.map(c => (
                <SelectItem key={c.id} value={c.id} className="font-bold">{c.label} শ্রেণি</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <Book className="w-4 h-4" /> বিষয় অনুযায়ী ফিল্টার:
          </div>
          <Select 
            value={filterSubject} 
            onValueChange={setFilterSubject}
            disabled={filterClassId === 'all'}
          >
            <SelectTrigger className="w-full bg-white font-bold">
              <SelectValue placeholder={filterClassId === 'all' ? "আগে শ্রেণি নির্বাচন করুন" : "সব বিষয়"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold">সব বিষয়</SelectItem>
              {availableSubjects.map(s => (
                <SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50 p-1 h-14">
          <TabsTrigger value="questions" className="gap-2 font-bold py-3 text-base data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
            <FileText className="w-5 h-5" />
            আমার প্রশ্ন ({toBengaliNumber(filteredQuestions.length)})
          </TabsTrigger>
          <TabsTrigger value="sheets" className="gap-2 font-bold py-3 text-base data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
            <BookOpen className="w-5 h-5" />
            লেকচার শিট ({toBengaliNumber(filteredSheets.length)})
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
              <Link href="/create-question" className="mt-4">
                <Button variant="outline" className="gap-2 font-bold border-primary text-primary hover:bg-primary/5">
                  <PlusCircle className="w-4 h-4" /> তৈরি করুন
                </Button>
              </Link>
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
              <Link href="/create-lecture-sheet" className="mt-4">
                <Button variant="outline" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-bold">
                  <PlusCircle className="w-4 h-4" /> তৈরি করুন
                </Button>
              </Link>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}
