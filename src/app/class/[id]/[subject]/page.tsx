
"use client";

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CLASSES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, HelpCircle, FileText, Download, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

export default function SubjectPage() {
  const params = useParams();
  const db = useFirestore();
  
  const id = params.id as string;
  const encodedSubject = params.subject as string;
  const subject = decodeURIComponent(encodedSubject);
  
  const currentClass = CLASSES.find(c => c.id === id);
  
  if (!currentClass) {
    notFound();
  }

  const bookQuery = useMemo(() => {
    if (!db || !id || !subject) return null;
    return query(
      collection(db, 'books'),
      where('classId', '==', id),
      where('subject', '==', subject)
    );
  }, [db, id, subject]);

  const { data: books, loading: loadingBooks } = useCollection(bookQuery);
  const hasBook = books && books.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/class/${id}`} className="p-2 hover:bg-secondary rounded-full transition-colors text-primary">
            <BookOpen className="w-6 h-6" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{subject}</h2>
            <p className="text-sm text-muted-foreground">{currentClass.label} শ্রেণি</p>
          </div>
        </div>
        <Link href={`/create-question?classId=${id}&subject=${encodeURIComponent(subject)}`}>
          <Button className="w-full md:w-auto gap-2 shadow-md bg-accent text-white hover:bg-accent/90">
            <HelpCircle className="w-4 h-4" />
            AI প্রশ্ন তৈরি করুন
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="read" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50 p-1">
          <TabsTrigger value="read" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-primary">
            <FileText className="w-4 h-4" />
            বই পড়ুন
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-primary">
            <Download className="w-4 h-4" />
            রিসোর্স
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="read" className="animate-fade-in">
          {loadingBooks ? (
            <div className="flex flex-col items-center justify-center p-20 bg-secondary/5 rounded-xl border border-dashed border-primary/20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground font-medium">বইটি খোঁজা হচ্ছে...</p>
            </div>
          ) : hasBook ? (
            <Card className="p-8 text-center border-2 border-primary/10 bg-primary/5 shadow-sm">
              <div className="w-40 h-56 bg-white rounded-lg flex items-center justify-center text-primary mx-auto mb-6 shadow-md border overflow-hidden relative group">
                {books[0].coverImageUrl ? (
                  <img src={books[0].coverImageUrl} alt="Book Cover" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4">
                    <FileText className="w-12 h-12 mb-2 opacity-30" />
                    <span className="text-xs font-bold text-muted-foreground text-center uppercase tracking-tighter">পাঠ্যবই</span>
                  </div>
                )}
              </div>
              <h3 className="text-2xl font-bold mb-8 text-primary">{subject}</h3>
              <div className="flex flex-col items-center justify-center gap-3">
                <a 
                  href={books[0].pdfUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full sm:w-auto"
                >
                  <Button className="gap-3 px-16 h-14 text-lg font-bold shadow-xl bg-primary hover:bg-primary/90 w-full sm:min-w-[240px] rounded-xl">
                    <BookOpen className="w-6 h-6" />
                    বই পড়ুন
                  </Button>
                </a>
                <p className="text-[10px] text-muted-foreground mt-2">
                  বড় ফাইল সরাসরি ওপেন করলে পড়া আরও সহজ হয়
                </p>
              </div>
            </Card>
          ) : (
            <Card className="border-2 border-dashed border-primary/20 bg-primary/5 min-h-[350px] flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-muted-foreground/30 mb-6 shadow-sm border-2 border-dashed border-primary/20">
                <BookOpen className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground/80">বইটি এখনো নেই</h3>
              <p className="text-muted-foreground max-w-sm mb-6 text-sm">
                দুঃখিত, এই বইটির ডিজিটাল কপি সিস্টেমে নেই। আপনি এডমিন হয়ে থাকলে সেটিং থেকে বইয়ের লিঙ্ক যোগ করতে পারেন।
              </p>
              <Link href="/settings">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white transition-all font-bold">
                  বই যোগ করুন
                </Button>
              </Link>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="resources">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:shadow-md transition-shadow bg-background border-primary/10">
              <CardHeader>
                <CardTitle className="text-base font-bold">অধ্যায় ভিত্তিক নোট</CardTitle>
                <CardDescription>শীঘ্রই আসছে...</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" className="w-full" disabled>ডাউনলোড করুন</Button>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow bg-background border-primary/10">
              <CardHeader>
                <CardTitle className="text-base font-bold">বিগত বছরের প্রশ্ন</CardTitle>
                <CardDescription>শীঘ্রই আসছে...</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" className="w-full" disabled>ডাউনলোড করুন</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
