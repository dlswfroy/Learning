
"use client";

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CLASSES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, HelpCircle, FileText, Download, Loader2, BookCopy, Printer, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function formatMath(text: string) {
  if (!text) return '';
  let formatted = text.replace(/\(\((.*?)\)\)/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
  
  formatted = formatted.replace(/\\text\{([^}]+)\}/g, '<span class="math-text">$1</span>');
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/_(\d+|[a-z]|[A-Z])/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/\^(\d+|[a-z]|[A-Z])/g, '<sup class="math-sup">$1</sup>');

  const fracRegex = /\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  formatted = formatted.replace(fracRegex, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');

  formatted = formatted.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '<span class="math-sqrt"><sup class="math-root">$1</sup>√<span class="math-sqrt-stem">$2</span></span>');
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-sqrt-stem">$1</span></span>');

  const symbolMap: Record<string, string> = {
    '\\\\log': 'log', '\\\\triangle': '△', '\\\\angle': '∠', '\\\\circ': '°',
    '\\\\theta': 'θ', '\\\\pi': 'π', '\\\\pm': '±', '\\\\times': '×',
    '\\\\neq': '≠', '\\\\ne': '≠', '\\\\leq': '≤', '\\\\geq': '≥',
    '\\\\degree': '°', '\\\\cdot': '·', '\\\\infty': '∞', '\\\\approx': '≈',
    '\\\\sum': '∑', '\\\\prod': '∏', '\\\\alpha': 'α', '\\\\beta': 'β',
    '\\\\gamma': 'γ', '\\\\delta': 'δ', '\\\\sigma': 'σ', '\\\\phi': 'φ', '\\\\omega': 'ω',
    '\\\\eta': 'η', '\\\\in': '∈', '\\\\mathbb\\{N\\}': 'ℕ', '\\\\mathbb\\{R\\}': 'ℝ', '\\\\mathbb\\{Z\\}': 'ℤ',
    '\\\\mathbb\\{Q\\}': 'ℚ', '\\\\subset': '⊂', '\\\\subseteq': '⊆', '\\\\cup': '∪',
    '\\\\cap': '∩', '\\\\emptyset': '∅', '\\\\forall': '∀', '\\\\exists': '∃', 
    '\\\\left': '', '\\\\right': '', '\\\\\%': '%', '\\\\setminus': '\\', '\\\\backslash': '\\'
  };
  
  Object.entries(symbolMap).forEach(([key, val]) => { 
    formatted = formatted.replace(new RegExp(key, 'g'), val); 
  });

  formatted = formatted.replace(/\\dot\{([^}]+)\}/g, '<span class="math-dot">$1</span>');
  formatted = formatted.replace(/\\/g, '');
  return formatted;
}

function naturalSort(a: any, b: any) {
  const nameA = a.chapterName || a.fileName || "";
  const nameB = b.chapterName || b.fileName || "";
  return nameA.localeCompare(nameB, 'bn', { numeric: true, sensitivity: 'base' });
}

export default function SubjectPage() {
  const params = useParams();
  const db = useFirestore();
  const router = useRouter();
  
  const id = params.id as string;
  const encodedSubject = params.subject as string;
  const subject = decodeURIComponent(encodedSubject);
  
  const currentClass = CLASSES.find(c => c.id === id);
  
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);

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

  const sheetsQuery = useMemo(() => {
    if (!db || !id || !subject) return null;
    return query(
      collection(db, 'lecture-sheets'),
      where('classId', '==', id),
      where('subject', '==', subject)
    );
  }, [db, id, subject]);

  const { data: books, loading: loadingBooks } = useCollection(bookQuery);
  const { data: sheets, loading: loadingSheets } = useCollection(sheetsQuery);
  
  const nctbBooks = useMemo(() => books?.filter(b => !b.isGuide) || [], [books]);
  const guideBooks = useMemo(() => {
    const list = books?.filter(b => b.isGuide) || [];
    return [...list].sort(naturalSort);
  }, [books]);

  const handleOpenNote = (note: any) => {
    setViewingNote(note);
    setIsDialogOpen(true);
  };

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
    <div className="space-y-6 animate-fade-in font-kalpurush">
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
          <Button className="w-full md:w-auto gap-2 shadow-md bg-accent text-white hover:bg-accent/90 font-bold">
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
            <p className="text-muted-foreground font-bold">বই খোঁজা হচ্ছে...</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-background border-primary/10 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" /> অধ্যায় ভিত্তিক নোট
                    </CardTitle>
                    <CardDescription className="font-bold">
                      {loadingSheets ? "লোড হচ্ছে..." : (sheets && sheets.length > 0 ? `${toBengaliNumber(sheets.length)}টি নোট পাওয়া গেছে` : "কোনো নোট পাওয়া যায়নি")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sheets && sheets.length > 0 ? (
                      sheets.map((sheet) => (
                        <div key={sheet.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20 group hover:border-primary/40 transition-all">
                          <span className="text-sm font-bold truncate flex-1 pr-4">{sheet.topic}</span>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 gap-2 font-bold border-primary text-primary"
                              onClick={() => handleOpenNote(sheet)}
                            >
                              <BookOpen className="w-3.5 h-3.5" /> পড়ুন
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      !loadingSheets && <p className="text-xs text-muted-foreground italic text-center py-4 font-bold">এই বিষয়ের কোনো নোট এখনো তৈরি করা হয়নি।</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-background border-primary/10 opacity-60">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Download className="w-4 h-4 text-primary" /> বিগত বছরের প্রশ্ন
                    </CardTitle>
                    <CardDescription className="font-bold">শীঘ্রই আসছে...</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="secondary" className="w-full font-bold" disabled>ডাউনলোড</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Note Viewer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl font-kalpurush">
          <div className="sticky top-0 z-50 bg-white border-b p-4 flex justify-between items-center shadow-sm">
            <h3 className="font-bold text-primary flex items-center gap-2">
              <FileText className="w-5 h-5" /> নোট প্রিভিউ
            </h3>
            <div className="flex gap-2">
              <Link href={`/create-lecture-sheet?id=${viewingNote?.id}&print=true`}>
                <Button size="sm" variant="secondary" className="gap-2 font-bold">
                  <Printer className="w-4 h-4" /> প্রিন্ট করুন
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          <div className="p-8 bg-slate-50 min-h-screen">
            <div className="paper-preview bg-white shadow-xl mx-auto p-[0.5in] relative overflow-hidden min-h-[11in] w-full" style={{ lineHeight: '1.1' }}>
              {/* Watermark */}
              <div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden"
                style={{ opacity: 0.08, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}
              >
                <span className="text-[80pt] font-black text-black">
                  {softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস'}
                </span>
              </div>

              <div className="relative z-10 space-y-4">
                <header className="text-center border-b-2 border-black pb-1 mb-2">
                  <h1 className="font-black text-[23px] text-black leading-tight">
                    {viewingNote?.institution || softwareConfig?.appName || 'শিক্ষা প্রতিষ্ঠানের নাম'}
                  </h1>
                  <div className="flex justify-center gap-8 text-[10pt] font-bold mt-1">
                    <span>শ্রেণি: {CLASSES.find(c => c.id === viewingNote?.classId)?.label || ''} শ্রেণি</span>
                    <span>বিষয়: {viewingNote?.subject}</span>
                  </div>
                </header>
                
                <h2 className="text-[13pt] font-bold text-center underline uppercase mb-4">
                  {viewingNote?.topic || 'লেকচার শিট'}
                </h2>

                <div 
                  className="content-area text-[10.5pt] text-justify whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: formatMath(viewingNote?.content || '') }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.85em; margin: 0 2px; }
        .math-num { border-bottom: 0.5pt solid black; padding: 0 1px; }
        .math-den { padding: 0 1px; }
        .math-dot { position: relative; display: inline-block; }
        .math-dot::after { content: "·"; position: absolute; top: -0.6em; left: 50%; transform: translateX(-50%); font-weight: bold; font-size: 1.2em; }
        .math-sqrt { display: inline-flex; align-items: center; }
        .math-sqrt-stem { border-top: 0.5pt solid black; padding-top: 1px; }
        .math-sup { font-size: 0.7em; vertical-align: super; }
        .math-sub { font-size: 0.7em; vertical-align: sub; }
        .math-text { font-family: 'Kalpurush', sans-serif; font-style: normal; }
        .paper-preview { color: black !important; }
      `}</style>
    </div>
  );
}
