
"use client";

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CLASSES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, HelpCircle, FileText, Download, Loader2, BookCopy, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

function toBengaliNumber(n: number | string): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

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
  
  const nctbBooks = useMemo(() => books?.filter(b => !b.isGuide) || [], [books]);
  const guideBooks = useMemo(() => books?.filter(b => b.isGuide) || [], [books]);

  const renderTextbookList = (bookList: any[]) => {
    if (bookList.length === 0) {
      return (
        <Card className="border-2 border-dashed border-primary/20 bg-primary/5 min-h-[250px] flex flex-col items-center justify-center p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-bold mb-2">পাঠ্যবই এখনো নেই</h3>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {bookList.map((book) => (
          <Card key={book.id} className="overflow-hidden hover:shadow-lg transition-shadow border-primary/10">
            <div className="aspect-[3/4] bg-muted relative group overflow-hidden">
              {book.coverImageUrl ? (
                <img src={book.coverImageUrl} alt="Book Cover" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                  <FileText className="w-16 h-16 text-primary/20 mb-4" />
                  <span className="text-sm font-bold text-primary/40 uppercase tracking-widest">পাঠ্যবই</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-6">
                <a href={book.pdfUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button className="w-full gap-2 font-bold bg-white text-primary hover:bg-white/90">
                    <BookOpen className="w-4 h-4" /> পড়ুন
                  </Button>
                </a>
              </div>
            </div>
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-bold truncate">{book.fileName || subject}</CardTitle>
              <CardDescription className="text-[10px] truncate">{subject} | {currentClass.label} শ্রেণি</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  };

  const renderGuideList = (bookList: any[]) => {
    if (bookList.length === 0) {
      return (
        <Card className="border-2 border-dashed border-primary/20 bg-primary/5 min-h-[250px] flex flex-col items-center justify-center p-8 text-center">
          <BookCopy className="w-12 h-12 text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-bold mb-2">গাইড বই এখনো নেই</h3>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {bookList.map((book, idx) => (
          <div key={book.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-primary/10 hover:border-primary/40 hover:shadow-sm transition-all group">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {toBengaliNumber(idx + 1)}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm md:text-base text-foreground group-hover:text-primary transition-colors truncate">
                  {book.chapterName || book.fileName || subject}
                </h4>
                <p className="text-[10px] text-muted-foreground truncate">
                  {subject} | {currentClass.label} শ্রেণি
                </p>
              </div>
            </div>
            <a href={book.pdfUrl} target="_blank" rel="noopener noreferrer" className="ml-4 shrink-0">
              <Button size="sm" className="gap-2 font-bold bg-primary text-white hover:bg-primary/90">
                <BookOpen className="w-4 h-4" /> পড়ুন
              </Button>
            </a>
          </div>
        ))}
      </div>
    );
  };

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

      <Tabs defaultValue="textbook" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-secondary/50 p-1">
          <TabsTrigger value="textbook" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-primary font-bold">
            <FileText className="w-4 h-4" /> পাঠ্যবই
          </TabsTrigger>
          <TabsTrigger value="guidebook" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-primary font-bold">
            <BookCopy className="w-4 h-4" /> গাইড বই
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-primary font-bold">
            <Download className="w-4 h-4" /> রিসোর্স
          </TabsTrigger>
        </TabsList>
        
        {loadingBooks ? (
          <div className="flex flex-col items-center justify-center p-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground font-medium">বই খোঁজা হচ্ছে...</p>
          </div>
        ) : (
          <>
            <TabsContent value="textbook" className="animate-fade-in">
              {renderTextbookList(nctbBooks)}
            </TabsContent>
            
            <TabsContent value="guidebook" className="animate-fade-in">
              {renderGuideList(guideBooks)}
            </TabsContent>
            
            <TabsContent value="resources">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-background border-primary/10"><CardHeader><CardTitle className="text-base font-bold">অধ্যায় ভিত্তিক নোট</CardTitle><CardDescription>শীঘ্রই আসছে...</CardDescription></CardHeader><CardContent><Button variant="secondary" className="w-full" disabled>ডাউনলোড</Button></CardContent></Card>
                <Card className="bg-background border-primary/10"><CardHeader><CardTitle className="text-base font-bold">বিগত বছরের প্রশ্ন</CardTitle><CardDescription>শীঘ্রই আসছে...</CardDescription></CardHeader><CardContent><Button variant="secondary" className="w-full" disabled>ডাউনলোড</Button></CardContent></Card>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
