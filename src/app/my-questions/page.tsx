
"use client";

import { useMemo, useState } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, deleteDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Edit, 
  Trash2, 
  Loader2, 
  Calendar, 
  BookOpen, 
  GraduationCap, 
  PlusCircle,
  AlertTriangle 
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
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { CLASSES } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

export default function MyQuestionsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const [deleting, setDeleting] = useState<string | null>(null);

  // কুয়েরি সহজ রাখা হয়েছে যাতে ইনডেক্সিং এরর না আসে
  const questionsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'questions'),
      where('userId', '==', user.uid)
    );
  }, [db, user]);

  const { data: rawQuestions, loading } = useCollection(questionsQuery);

  // ক্লায়েন্ট সাইডে সর্টিং করা হয়েছে
  const questions = useMemo(() => {
    if (!rawQuestions) return [];
    return [...rawQuestions].sort((a, b) => {
      const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [rawQuestions]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteDoc(doc(db!, 'questions', id));
      toast({ title: "সফল", description: "প্রশ্নপত্রটি মুছে ফেলা হয়েছে।" });
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "মুছে ফেলা সম্ভব হয়নি।" });
    } finally {
      setDeleting(null);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
        <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-bold">লগইন করুন</h3>
        <p className="text-muted-foreground mb-6">আপনার তৈরি করা প্রশ্নসমূহ দেখতে লগইন করুন।</p>
        <Link href="/auth">
          <Button>লগইন পেজে যান</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">আমার প্রশ্নসমূহ</h2>
            <p className="text-sm text-muted-foreground">আপনার তৈরি করা সব প্রশ্নপত্রের তালিকা ({questions.length})</p>
          </div>
        </div>
        <Link href="/create-question">
          <Button className="gap-2 shadow-lg">
            <PlusCircle className="w-4 h-4" /> নতুন প্রশ্ন তৈরি করুন
          </Button>
        </Link>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground font-medium">লোড হচ্ছে...</p>
        </div>
      ) : questions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {questions.map((q) => (
            <Card key={q.id} className="hover:border-primary/40 transition-all group shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase">
                    {CLASSES.find(c => c.id === q.classId)?.label || 'অজানা'} শ্রেণি
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {q.updatedAt?.toDate ? format(q.updatedAt.toDate(), 'dd MMMM, yyyy', { locale: bn }) : 'অজানা তারিখ'}
                  </div>
                </div>
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors truncate">
                  {q.exam || 'পরীক্ষার নাম নেই'}
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> {q.subject}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm text-muted-foreground truncate font-medium">
                  {q.institution || 'শিক্ষা প্রতিষ্ঠানের নাম নেই'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  মোট প্রশ্ন: {q.questions?.length || 0} টি
                </p>
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
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive w-5 h-5" /> আপনি কি নিশ্চিত?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        এই প্রশ্নপত্রটি স্থায়ীভাবে মুছে ফেলা হবে। এটি আর ফিরে পাওয়া সম্ভব নয়।
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>বাতিল</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDelete(q.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        হ্যাঁ, মুছে ফেলুন
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Link href={`/create-question?id=${q.id}`}>
                  <Button variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary/5">
                    <Edit className="w-3 h-3" /> এডিট করুন
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-20 bg-secondary/5 rounded-3xl border-2 border-dashed border-primary/20 text-center">
          <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center text-muted-foreground/30 mb-6 shadow-sm border">
            <FileText className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-foreground/80 mb-2">কোনো প্রশ্নপত্র নেই</h3>
          <p className="text-muted-foreground max-w-sm mb-6">
            আপনি এখনো কোনো প্রশ্নপত্র তৈরি করেননি।
          </p>
          <Link href="/create-question">
            <Button className="font-bold px-8">প্রথম প্রশ্ন তৈরি করুন</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
