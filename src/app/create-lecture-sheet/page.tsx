
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Save, FileText, ArrowLeft, Loader2, BookOpen } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function formatMath(text: string) {
  if (!text) return '';
  let formatted = text.replace(/\(\((.*?)\)\)/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
  
  formatted = formatted.replace(/\\text\{([^}]+)\}/g, '<span class="math-text">$1</span>');

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
    '\\\\left': '', '\\\\right': '', '\\\\\%': '%'
  };
  
  Object.entries(symbolMap).forEach(([key, val]) => { 
    formatted = formatted.replace(new RegExp(key, 'g'), val); 
  });
  
  // Handle fractions recursively by matching innermost ones first
  let prev;
  const simpleFracRegex = /\\frac\{([^{}]+)\}\s*\{([^{}]+)\}/g;
  do {
    prev = formatted;
    formatted = formatted.replace(simpleFracRegex, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
  } while (formatted !== prev);
  
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/\^(\d+|[a-z]|[A-Z])/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/_(\d+|[a-z]|[A-Z])/g, '<sub class="math-sub">$1</sub>');
  
  formatted = formatted.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '<span class="math-sqrt"><sup class="math-root">$1</sup>√<span class="math-sqrt-stem">$2</span></span>');
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-sqrt-stem">$1</span></span>');
  
  formatted = formatted.replace(/\\/g, ''); 
  return formatted;
}

function CreateLectureSheetContent() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('id');
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [existingData, setExistingData] = useState<any>(null);
  
  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appLogoUrl = softwareConfig?.appLogoUrl || '';

  const [data, setData] = useState({
    institution: 'টপ গ্রেড টিউটোরিয়ালস',
    classId: '',
    subject: '',
    topic: '',
    content: ''
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
            content: docData.content || ''
          });
        }
      } catch (e) {} finally { setLoading(false); }
    }
    if (user && db) loadSheet();
  }, [editId, db, user, router]);

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

  if (loading || userLoading) return <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]"><Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /><p className="text-muted-foreground">অ্যাক্সেস চেক করা হচ্ছে...</p></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      <div className="no-print space-y-8">
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm"><BookOpen className="w-7 h-7" /></div>
            <h2 className="text-2xl font-bold text-primary">লেকচার শিট নির্মাতা</h2>
          </div>
          <Button variant="ghost" onClick={() => router.back()} className="gap-2"><ArrowLeft className="w-4 h-4" /> ফিরে যান</Button>
        </header>

        <Card className="shadow-md">
          <CardHeader className="bg-primary/5 border-b py-3"><CardTitle className="text-base flex items-center gap-2 font-bold"><FileText className="w-4 h-4 text-primary" /> শিট সংক্রান্ত তথ্য</CardTitle></CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label>
                <Input value={data.institution || ''} onChange={e => setData(prev => ({...prev, institution: e.target.value}))} />
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
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">টপিক / শিরোনাম</label>
              <Input value={data.topic || ''} onChange={e => setData(prev => ({...prev, topic: e.target.value}))} placeholder="যেমন: গাণিতিক সূত্রাবলী বা সেট থিওরি আলোচনা" />
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
              className="min-h-[400px] text-base leading-relaxed" 
            />
          </CardContent>
        </Card>

        <div className="flex gap-4 pt-8">
          <Button onClick={handleSave} disabled={saving} className="gap-2 px-8 font-bold"><Save className="w-4 h-4" /> সেভ করুন</Button>
          <Button onClick={() => window.print()} variant="secondary" className="gap-2 px-10 shadow-lg font-bold"><Printer className="w-4 h-4" /> প্রিন্ট / পিডিএফ</Button>
        </div>
      </div>

      <div className="print-only">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { 
              size: A4; 
              margin: 0.5in !important; 
            }
            body, html { 
              margin: 0 !important; 
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body { 
              font-family: 'Kalpurush', sans-serif !important; 
              font-size: 9pt !important; 
              color: black !important; 
              line-height: 1.5 !important; 
            }
            .paper { 
              width: 100% !important; 
              text-align: justify; 
              position: relative; 
              z-index: 10;
              background: transparent !important;
              padding: 0 !important;
            }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 1.5pt solid black; padding-bottom: 10px; }
            .inst-name { font-size: 16pt; font-weight: 800; }
            .topic-title { font-size: 13pt; font-weight: bold; margin: 15px 0; text-align: center; text-decoration: underline; }
            .meta-info { display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px; font-size: 9.5pt; border-top: 0.5pt solid #ddd; padding-top: 5px; }
            .content-area { white-space: pre-wrap; font-size: 9pt; background: transparent !important; }
            
            .watermark-container {
              position: fixed !important;
              top: 50% !important;
              left: 50% !important;
              transform: translate(-50%, -50%) !important;
              width: 60% !important;
              opacity: 0.08 !important;
              z-index: 0 !important;
              pointer-events: none;
              display: flex !important;
              justify-content: center;
              align-items: center;
            }
            .watermark-container img {
              max-width: 100% !important;
              max-height: 100% !important;
              object-fit: contain !important;
              display: block !important;
            }
            
            .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.85em; margin: 0 2px; }
            .math-num { border-bottom: 0.5pt solid black; padding: 0 1px; }
            .math-den { padding: 0 1px; }
            .math-sqrt { display: inline-flex; align-items: center; }
            .math-sqrt-stem { border-top: 0.5pt solid black; padding-top: 1px; }
            .math-sup { font-size: 0.7em; vertical-align: super; }
            .math-sub { font-size: 0.7em; vertical-align: sub; }
            .math-text { font-family: 'Kalpurush', sans-serif; font-style: normal; }
            .no-print { display: none !important; }
          }
        `}} />
        
        {appLogoUrl && (
          <div className="watermark-container">
            <img src={appLogoUrl} alt="watermark" />
          </div>
        )}

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

export default function CreateLectureSheetPage() { return <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>}><CreateLectureSheetContent /></Suspense>; }
