
"use client";

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CLASSES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, HelpCircle, FileText, Download, Loader2, X, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

export default function SubjectPage() {
  const params = useParams();
  const db = useFirestore();
  const [showReader, setShowReader] = useState(false);
  const [readerError, setReaderError] = useState(false);
  
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

  if (showReader && hasBook) {
    const pdfUrl = books[0].pdfUrl;
    
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-fade-in overflow-hidden">
        <header className="h-14 border-b bg-primary text-primary-foreground flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <h2 className="font-bold text-sm truncate max-w-[200px] sm:max-w-none">
              {subject} - {currentClass.label} শ্রেণি
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-xs font-bold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              সরাসরি ওপেন করুন
            </a>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                setShowReader(false);
                setReaderError(false);
              }}
              className="text-primary-foreground hover:bg-white/10"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </header>
        <div className="flex-1 bg-muted relative">
          {readerError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-lg font-bold">পিডিএফ সরাসরি এখানে লোড করা যাচ্ছে না</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                নিরাপত্তার কারণে কিছু পিডিএফ ব্রাউজারের আইফ্রেমে লোড হতে বাধা দেয়। অনুগ্রহ করে সরাসরি ওপেন বাটনে ক্লিক করুন।
              </p>
              <a 
                href={pdfUrl} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button className="gap-2 font-bold shadow-lg">
                  <ExternalLink className="w-4 h-4" />
                  নতুন ট্যাবে ওপেন করুন
                </Button>
              </a>
            </div>
          ) : (
            <iframe 
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
              className="w-full h-full border-none"
              title="PDF Reader"
              onError={() => setReaderError(true)}
            />
          )}
        </div>
      </div>
    );
  }

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
          <Button className="w-full md:w-auto gap-2 shadow-md bg-accent hover:bg-accent/90">
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
            <Card className="p-8 text-center border-2 border-primary/20 bg-primary/5 shadow-sm">
              <div className="w-32 h-44 bg-white rounded-lg flex items-center justify-center text-primary mx-auto mb-6 shadow-md border overflow-hidden">
                {books[0].coverImageUrl ? (
                  <img src={books[0].coverImageUrl} alt="Book Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4">
                    <FileText className="w-10 h-10 mb-2 opacity-30" />
                    <span className="text-[10px] font-bold text-muted-foreground text-center">{subject}</span>
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold mb-6">{subject}</h3>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button className="gap-2 px-10 h-12 text-base font-bold shadow-lg bg-primary hover:bg-primary/90 w-full sm:w-auto" onClick={() => setShowReader(true)}>
                  <BookOpen className="w-5 h-5" />
                  পড়া শুরু করুন
                </Button>
                <a href={books[0].pdfUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                  <Button variant="outline" className="gap-2 px-6 h-12 border-primary text-primary w-full">
                    <ExternalLink className="w-4 h-4" />
                    সরাসরি ওপেন
                  </Button>
                </a>
              </div>
            </Card>
          ) : (
            <Card className="border-2 border-dashed border-primary/20 bg-primary/5 min-h-[350px] flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-muted-foreground/30 mb-6 shadow-sm border-2 border-dashed border-primary/20">
                <BookOpen className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground/80">বইটি এখনো নেই</h3>
              <p className="text-muted-foreground max-w-sm mb-6 text-sm">
                দুঃখিত, এই বইটির ডিজিটাল কপি সিস্টেমে নেই। আপনি সেটিং থেকে বইয়ের লিঙ্ক যোগ করতে পারেন।
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
