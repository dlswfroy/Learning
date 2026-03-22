
"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Save, FileText, ArrowLeft, Loader2, BookOpen, ScanText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import Tesseract from 'tesseract.js';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function formatMath(text: string) {
  if (!text) return '';
  // Cleanup initial wrappers
  let formatted = text.replace(/\(\((.*?)\)\)/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
  
  // 1. Text processing first
  formatted = formatted.replace(/\\text\{([^}]+)\}/g, '<span class="math-text">$1</span>');

  // 2. Subscripts / Superscripts (Do this early to remove braces that might confuse fraction regex)
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/\^(\d+|[a-z]|[A-Z])/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/_(\d+|[a-z]|[A-Z])/g, '<sub class="math-sub">$1</sub>');

  // 3. Square Roots (Do this before fractions to remove nested braces)
  formatted = formatted.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '<span class="math-sqrt"><sup class="math-root">$1</sup>√<span class="math-sqrt-stem">$2</span></span>');
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-sqrt-stem">$1</span></span>');

  // 4. Fractions (Loop to handle nesting, now simpler since inner braces are replaced by tags)
  let prev;
  const fracRegex = /\\frac\{([^}]+)\}\s*\{([^}]+)\}/g;
  do {
    prev = formatted;
    formatted = formatted.replace(fracRegex, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
  } while (formatted !== prev);

  // 5. Symbols
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
  
  // 6. Final cleanup of remaining backslashes
  formatted = formatted.replace(/\\/g, '');
  return formatted;
}

function CreateLectureSheetContent() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('id');
  const isPrintMode = searchParams.get('print') === 'true';
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [existingData, setExistingData] = useState<any>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  
  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);

  const [data, setData] = useState({
    institution: 'টপ গ্রেড টিউটোরিয়ালস',
    classId: '',
    subject: '',
    topic: '',
    content: '',
    type: 'written'
  });

  useEffect(() => { if (!userLoading && !user) router.push('/auth'); }, [user, userLoading, router]);
  
  useEffect(() => {
    async function loadSheet() {
      if (!editId || !db || !user) return;
      try {
        const docRef = doc(db, 'lecture-sheets', editId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          if (docData.userId !== user.uid) { router.push('/'); return; }
          setExistingData(docData);
          setData({
            institution: docData.institution || 'টপ গ্রেড টিউটোরিয়ালস',
            classId: docData.classId || '',
            subject: docData.subject || '',
            topic: docData.topic || '',
            content: docData.content || '',
            type: docData.type || 'written'
          });
        }
      } catch (e) {} finally { setLoading(false); }
    }
    if (user && db) loadSheet();
  }, [editId, db, user, router]);

  useEffect(() => {
    if (isPrintMode && !loading && !userLoading && data.content) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isPrintMode, loading, userLoading, data.content]);

  const subjects = useMemo(() => data.classId ? getSubjectsForClass(data.classId) : [], [data.classId]);

  const handleSave = () => {
    if (!user || !db) { toast({ title: "লগইন প্রয়োজন", variant: "destructive" }); return; }
    if (!data.topic || !data.content) { toast({ title: "তথ্য অসম্পূর্ণ", description: "শিরোনাম ও বিষয়বস্তু অবশ্যই লিখুন।" }); return; }
    
    setSaving(true);
    const docId = editId || doc(collection(db, 'lecture-sheets')).id;
    const ref = doc(db, 'lecture-sheets', docId);
    
    const payload: any = {
      ...data,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };

    if (!editId) {
      payload.createdAt = serverTimestamp();
    } else if (existingData?.createdAt) {
      payload.createdAt = existingData.createdAt;
    }

    setDoc(ref, payload, { merge: true })
      .then(() => { 
        setSaving(false); 
        toast({ title: "সফল!", description: "লেকচার শিট সেভ হয়েছে।" }); 
        if (!editId) router.replace(`/create-lecture-sheet?id=${docId}`); 
      })
      .catch(async (error) => { 
        setSaving(false); 
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: ref.path, operation: 'write', requestResourceData: payload 
        })); 
      });
  };

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    toast({ title: "স্ক্যান শুরু হয়েছে", description: "লোকাল স্ক্যানার ইমেজ প্রসেস করছে, অনুগ্রহ করে অপেক্ষা করুন..." });

    try {
      const result = await Tesseract.recognize(file, 'ben+eng', {
        logger: m => console.log(m)
      });
      
      if (result && result.data.text) {
        const text = result.data.text.trim();
        setData(prev => ({ ...prev, content: prev.content ? prev.content + '\n\n' + text : text }));
        toast({ title: "সফল!", description: "টেক্সট এক্সট্রাক্ট করা হয়েছে।" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "স্ক্যান ব্যর্থ হয়েছে", description: "আবার চেষ্টা করুন।" });
    } finally {
      setIsScanning(false);
      if (ocrInputRef.current) ocrInputRef.current.value = '';
    }
  };

  if (loading || userLoading) return <div className="flex flex-col items-center justify-center p-20 min-h-[50vh] font-kalpurush"><Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /><p className="text-muted-foreground font-bold">অ্যাক্সেস চেক করা হচ্ছে...</p></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32 font-kalpurush">
      <div className={cn("no-print space-y-8", isPrintMode && "hidden")}>
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm"><BookOpen className="w-7 h-7" /></div>
            <h2 className="text-2xl font-bold text-primary">লেকচার শিট নির্মাতা</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold"><ArrowLeft className="w-4 h-4" /> ফিরে যান</Button>
            <Button variant="secondary" onClick={() => window.print()} className="gap-2 font-bold"><Printer className="w-4 h-4" /> প্রিন্ট</Button>
          </div>
        </header>

        <Card className="shadow-md">
          <CardHeader className="bg-primary/5 border-b py-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2 font-bold"><FileText className="w-4 h-4 text-primary" /> শিট সংক্রান্ত তথ্য</CardTitle>
              <div className="flex gap-2">
                <input type="file" ref={ocrInputRef} className="hidden" accept="image/*" onChange={handleOCR} />
                <Button 
                  onClick={() => ocrInputRef.current?.click()} 
                  disabled={isScanning}
                  variant="outline" 
                  className="gap-2 border-indigo-600 text-indigo-700 font-bold hover:bg-indigo-50"
                  title="লোকাল স্ক্যান (Non-AI)"
                >
                  {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
                  এআই স্ক্যান (Local)
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label>
                <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={data.institution || ''} onChange={e => setData(prev => ({...prev, institution: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">শ্রেণি</label>
                <Select onValueChange={v => setData(prev => ({...prev, classId: v}))} value={data.classId || ''}>
                  <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">বিষয়</label>
                <Select onValueChange={v => setData(prev => ({...prev, subject: v}))} value={data.subject || ''} disabled={!data.classId}>
                  <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">শিটের ধরন</label>
                <Select onValueChange={v => setData(prev => ({...prev, type: v}))} value={data.type || 'written'}>
                  <SelectTrigger><SelectValue placeholder="ধরণ নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="written">লিখিত</SelectItem>
                    <SelectItem value="mcq">বহুনির্বাচনি</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">টপিক / শিরোনাম</label>
              <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" value={data.topic || ''} onChange={e => setData(prev => ({...prev, topic: e.target.value}))} placeholder="যেমন: গাণিতিক সূত্রাবলী বা সেট থিওরি আলোচনা" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <label className="text-sm font-bold mb-2 block">লেকচার কন্টেন্ট</label>
            <Textarea 
              placeholder="এখানে আপনার লেকচার নোট লিখুন... সেট লিখতে {x \in \mathbb{N} : x < 4} এভাবে টাইপ করুন।" 
              value={data.content || ''} 
              onChange={e => setData(prev => ({...prev, content: e.target.value}))} 
              className="min-h-[400px] text-base leading-relaxed font-bold" 
            />
          </CardContent>
        </Card>

        <div className="flex gap-4 pt-8">
          <Button onClick={handleSave} disabled={saving} className="gap-2 px-8 font-bold"><Save className="w-4 h-4" /> সেভ করুন</Button>
          <Button onClick={() => window.print()} variant="secondary" className="gap-2 px-10 shadow-lg font-bold"><Printer className="w-4 h-4" /> প্রিন্ট</Button>
        </div>
      </div>

      {isPrintMode && (
        <div className="no-print flex justify-center py-4 border-b bg-muted/10">
          <Button variant="outline" onClick={() => router.back()} className="gap-2 font-bold border-primary text-primary">
            <ArrowLeft className="w-4 h-4" /> লাইব্রেরিতে ফিরে যান
          </Button>
        </div>
      )}

      <div className={cn("print-only font-kalpurush", isPrintMode && "block")}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print, screen {
            ${isPrintMode ? `
              body { background: #f0f2f5 !important; }
              .paper { 
                background: white !important; 
                margin: 0 auto !important; 
                padding: 0 !important; 
                box-shadow: 0 0 15px rgba(0,0,0,0.1);
                min-height: 11in;
                position: relative;
                z-index: 1;
              }
            ` : ''}
            .paper { 
              width: 100% !important; 
              text-align: justify; 
              color: black !important;
              line-height: 1.1;
              position: relative;
            }
            /* Watermark for Lecture Sheets */
            .paper::before {
              content: "${softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস'}";
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 80pt;
              font-weight: 900;
              color: rgba(0, 0, 0, 0.08);
              white-space: nowrap;
              pointer-events: none;
              z-index: 0;
            }
            .header { margin-bottom: 2px; border-bottom: 1.5pt solid black; padding-bottom: 2px; position: relative; z-index: 10; text-align: center; margin-top: 0 !important; }
            .inst-name { font-size: 23px !important; font-weight: 800; line-height: 1.1; }
            .topic-title { font-size: 13pt; font-weight: bold; margin: 4px 0; text-align: center; text-decoration: underline; line-height: 1.1; }
            .meta-info { display: flex; justify-content: center; gap: 20pt; font-weight: 900; margin-top: 2px; font-size: 10pt; border-top: 0.5pt solid #ddd; padding-top: 2px; line-height: 1.1; }
            .content-area { white-space: pre-wrap; font-size: 9.5pt; line-height: 1.1; background: transparent !important; position: relative; z-index: 10; }
            
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
          }
          @media print {
            .paper { margin: 0 !important; box-shadow: none !important; padding: 0 !important; padding-top: 0 !important; }
            @page { size: auto; margin: 0.5in !important; }
          }
        `}} />
        
        <div className="paper">
          <div className="header">
            <div className="inst-name">{data.institution || 'শিক্ষা প্রতিষ্ঠানের নাম'}</div>
            <div className="meta-info">
              <div>শ্রেণি: {CLASSES.find(c => c.id === data.classId)?.label || ''} শ্রেণি</div>
              <div>বিষয়: {data.subject}</div>
            </div>
          </div>
          <div className="topic-title">{data.topic || 'লেকচার শিট'}</div>
          <div className="content-area" dangerouslySetInnerHTML={{ __html: formatMath(data.content) }} />
        </div>
      </div>
    </div>
  );
}

export default function CreateLectureSheetPage() { return <Suspense fallback={<div className="flex justify-center p-20 font-kalpurush"><Loader2 className="animate-spin text-primary" /></div>}><CreateLectureSheetContent /></Suspense>; }
