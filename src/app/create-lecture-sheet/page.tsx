
"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Save, FileText, ArrowLeft, Loader2, BookOpen, ScanText, Eye, Settings2, SlidersHorizontal, Image as ImageIcon, X, Type, Compass, RotateCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import Tesseract from 'tesseract.js';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function formatMath(text: string) {
  if (!text) return '';
  let formatted = text.replace(/\(\((.*?)\)\)/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
  
  formatted = formatted.replace(/\\text\{([^}]+)\}/g, '<span class="math-text">$1</span>');

  const fracRegex = /\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  formatted = formatted.replace(fracRegex, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');

  formatted = formatted.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '<span class="math-sqrt"><sup class="math-root">$1</sup>√<span class="math-sqrt-stem">$2</span></span>');
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-sqrt-stem">$1</span></span>');

  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/\^(\d+|[a-z]|[A-Z])/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/_(\d+|[a-z]|[A-Z])/g, '<sub class="math-sub">$1</sub>');

  const symbolMap: Record<string, string> = {
    '\\\\log': 'log', '\\\\triangle': '△', '\\\\angle': '∠', '\\\\circ': '°',
    '\\\\theta': 'θ', '\\\\pi': 'π', '\\\\pm': '±', '\\\\times': '×',
    '\\\\neq': '≠', '\\\\ne': '≠', '\\\\leq': '≤', '\\\\geq': '≥',
    '\\\\degree': '°', '\\\\cdot': '·', '\\\\infty': '∞', '\\\\approx': '≈',
    '\\\\sum': '∑', '\\\\prod': '∏', '\\\\alpha': 'α', '\\\\beta': 'β',
    '\\\\gamma': 'γ', '\\\\delta': 'δ', '\\\\sigma': 'σ', '\\\\phi': 'φ', '\\\\omega': 'ω',
    '\\\\eta': 'η', '\\\\rho': 'ρ', '\\\\lambda': 'λ', '\\\\mu': 'μ',
    '\\\\div': '÷', '\\\\rightarrow': '→', '\\\\to': '→', '\\\\arrow': '→',
    '\\\\in': '∈', '\\\\mathbb\\{N\\}': 'ℕ', '\\\\mathbb\\{R\\}': 'ℝ', '\\\\mathbb\\{Z\\}': 'ℤ',
    '\\\\mathbb\\{Q\\}': 'ℚ', '\\\\subset': '⊂', '\\\\subseteq': '⊆', '\\\\cup': '∪',
    '\\\\cap': '∩', '\\\\emptyset': '∅', '\\\\forall': '∀', '\\\\exists': '∃', 
    '\\\\Rightarrow': '⇒', '\\\\leftarrow': '←', '\\\\Leftarrow': '⇐', 
    '\\\\leftrightarrow': '↔', '\\\\Leftrightarrow': '⇔',
    '\\\\left': '', '\\\\right': '', '\\\\\%': '%', '\\\\setminus': '\\', '\\\\backslash': '\\'
  };
  
  Object.entries(symbolMap).forEach(([key, val]) => { 
    formatted = formatted.replace(new RegExp(key, 'g'), val); 
  });

  formatted = formatted.replace(/\\dot\{([^}]+)\}/g, '<span class="math-dot">$1</span>');
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
  const watermarkImageRef = useRef<HTMLInputElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  
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

  const [printSettings, setPrintSettings] = useState<any>({
    marginTop: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.5,
    marginRight: 0.5,
    watermarkOpacity: 8,
    watermarkText: '',
    watermarkFontSize: 80,
    watermarkRotation: -45,
    watermarkImageUrl: '',
    watermarkImageSize: 70,
    watermarkType: 'text'
  });

  const [paginatedPages, setPaginatedPages] = useState<string[]>([]);

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
          if (docData.printSettings) {
            setPrintSettings(prev => ({
              ...prev, 
              ...docData.printSettings,
              watermarkRotation: docData.printSettings.watermarkRotation !== undefined ? docData.printSettings.watermarkRotation : -45,
              watermarkImageSize: docData.printSettings.watermarkImageSize !== undefined ? docData.printSettings.watermarkImageSize : 70
            }));
          }
        }
      } catch (e) {} finally { setLoading(false); }
    }
    if (user && db) loadSheet();
  }, [editId, db, user, router]);

  useEffect(() => {
    if (isPrintMode && data.content && measurementRef.current) {
      const container = measurementRef.current;
      const contentHtml = formatMath(data.content);
      
      const mT = parseFloat(String(printSettings.marginTop)) || 0.5;
      const mB = parseFloat(String(printSettings.marginBottom)) || 0.5;
      const mL = parseFloat(String(printSettings.marginLeft)) || 0.5;
      const mR = parseFloat(String(printSettings.marginRight)) || 0.5;

      // Sync measurement width with custom margins accurately
      container.style.width = (8.27 - mL - mR) + 'in';
      
      const tempLines = contentHtml.split('\n');
      const lineHtml = tempLines.map(line => `<div class="measure-line" style="margin-bottom: 0px; min-height: 1.2em;">${line.trim() || '&nbsp;'}</div>`).join('');
      container.innerHTML = lineHtml;
      
      // Calculate available height dynamically
      const headerSpace = 130; // Increased buffer for safety
      const footerSpace = 60;
      const totalPageHeightPx = 11.69 * 96;
      const availableHeightPx = totalPageHeightPx - (mT * 96) - (mB * 96) - headerSpace - footerSpace;
      const topicSpacePx = 60; 
      
      const newPages: string[] = [];
      let currentChunk = "";
      let currentHeight = 0;

      const lines = container.querySelectorAll('.measure-line');
      lines.forEach((line) => {
        const h = (line as HTMLElement).offsetHeight || 18; // Fallback height
        const effectiveLimit = (newPages.length === 0) ? (availableHeightPx - topicSpacePx) : availableHeightPx;

        if (currentHeight > 0 && currentHeight + h > effectiveLimit) {
          if (currentChunk.trim() !== "") {
            newPages.push(currentChunk);
          }
          currentChunk = line.innerHTML + "<br/>";
          currentHeight = h;
        } else {
          currentChunk += line.innerHTML + "<br/>";
          currentHeight += h;
        }
      });
      
      if (currentChunk.trim() !== "") {
        newPages.push(currentChunk);
      }
      
      setPaginatedPages(newPages.filter(p => p.replace(/<br\/>/g, '').trim() !== ""));
    }
  }, [isPrintMode, data.content, printSettings.marginTop, printSettings.marginBottom, printSettings.marginLeft, printSettings.marginRight]);

  const subjects = useMemo(() => data.classId ? getSubjectsForClass(data.classId) : [], [data.classId]);

  const handleSave = () => {
    if (!user || !db) { toast({ title: "লগইন প্রয়োজন", variant: "destructive" }); return; }
    if (!data.topic || !data.content) { toast({ title: "তথ্য অসম্পূর্ণ", description: "শিরোনাম ও বিষয়বস্তু অবশ্যই লিখুন।" }); return; }
    
    setSaving(true);
    const docId = editId || doc(collection(db, 'lecture-sheets')).id;
    const ref = doc(db, 'lecture-sheets', docId);
    
    const payload: any = {
      ...data,
      printSettings: {
        ...printSettings,
        marginTop: parseFloat(String(printSettings.marginTop)) || 0.5,
        marginBottom: parseFloat(String(printSettings.marginBottom)) || 0.5,
        marginLeft: parseFloat(String(printSettings.marginLeft)) || 0.5,
        marginRight: parseFloat(String(printSettings.marginRight)) || 0.5,
        watermarkRotation: parseInt(printSettings.watermarkRotation?.toString()) || 0,
        watermarkImageSize: parseInt(printSettings.watermarkImageSize?.toString()) || 70
      },
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };

    if (!editId) payload.createdAt = serverTimestamp();
    else if (existingData?.createdAt) payload.createdAt = existingData.createdAt;

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

  const handleOCR = async (Eisen: React.ChangeEvent<HTMLInputElement>) => {
    const file = Eisen.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    toast({ title: "স্ক্যান শুরু হয়েছে", description: "লোকাল স্ক্যানার ইমেজ প্রসেস করছে, অনুগ্রহ করে অপেক্ষা করুন..." });

    try {
      const result = await Tesseract.recognize(file, 'ben+eng');
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

  const handleWatermarkImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPrintSettings(p => ({ ...p, watermarkImageUrl: base64, watermarkType: 'image' }));
      toast({ title: "সফল", description: "জলছাপ লোগো সেট করা হয়েছে।" });
    };
    reader.readAsDataURL(file);
  };

  const handlePrintView = () => {
    if (!data.content) {
      toast({ variant: "destructive", title: "তথ্য নেই", description: "প্রিন্ট ভিউ দেখার জন্য অন্তত কিছু লিখুন।" });
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set('print', 'true');
    if (editId) params.set('id', editId);
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  if (loading || userLoading) return <div className="flex flex-col items-center justify-center p-20 min-h-[50vh] font-kalpurush"><Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /><p className="text-muted-foreground font-bold">অ্যাক্সেস চেক করা হচ্ছে...</p></div>;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-32 font-kalpurush">
      {/* Invisible measurement container for pagination */}
      <div 
        ref={measurementRef} 
        className="fixed invisible pointer-events-none whitespace-pre-wrap text-[10.5pt] font-kalpurush box-border" 
        style={{ width: '7.27in', lineHeight: '1.2' }} 
      />

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

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <aside className="w-full lg:w-80 shrink-0 space-y-6 sticky top-24">
            <Card className="shadow-md border-primary/10">
              <CardHeader className="bg-primary/5 border-b py-3">
                <CardTitle className="text-base flex items-center gap-2 font-bold text-primary"><FileText className="w-4 h-4" /> শিট সংক্রান্ত তথ্য</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label>
                  <Input value={data.institution || ''} onChange={Eisen => setData(prev => ({...prev, institution: Eisen.target.value}))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">শ্রেণি</label>
                  <Select onValueChange={v => setData(prev => ({...prev, classId: v}))} value={data.classId || ''}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">বিষয়</label>
                  <Select onValueChange={v => setData(prev => ({...prev, subject: v}))} value={data.subject || ''} disabled={!data.classId}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">শিটের ধরন</label>
                  <Select onValueChange={v => setData(prev => ({...prev, type: v}))} value={data.type || 'written'}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="ধরণ নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent><SelectItem value="written">লিখিত</SelectItem><SelectItem value="mcq">বহুনির্বাচনি</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">টপিক / শিরোনাম</label>
                  <Input value={data.topic || ''} onChange={Eisen => setData(prev => ({...prev, topic: Eisen.target.value}))} placeholder="যেমন: গাণিতিক সূত্রাবলী" />
                </div>
                <div className="pt-4 border-t">
                  <input type="file" ref={ocrInputRef} className="hidden" accept="image/*" onChange={handleOCR} />
                  <Button onClick={() => ocrInputRef.current?.click()} disabled={isScanning} variant="outline" className="w-full gap-2 border-indigo-600 text-indigo-700 font-bold hover:bg-indigo-50">
                    {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />} এআই স্ক্যান (Local)
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-3">
              <Button onClick={handleSave} disabled={saving} className="w-full gap-2 font-bold h-11"><Save className="w-4 h-4" /> সেভ করুন</Button>
              <Button onClick={handlePrintView} variant="outline" className="w-full gap-2 border-primary text-primary font-bold hover:bg-primary/5 h-11"><Eye className="w-4 h-4" /> প্রিন্ট ভিউ</Button>
            </div>
          </aside>

          <div className="flex-1 w-full space-y-6">
            <Card className="shadow-sm border-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <label className="text-sm font-bold text-primary flex items-center gap-2"><BookOpen className="w-4 h-4" /> লেকচার কন্টেন্ট এডিটর</label>
                  <span className="text-[10px] text-muted-foreground font-bold italic">ম্যাথ ফরমেট সাপোর্ট করে</span>
                </div>
                <Textarea 
                  placeholder="এখানে আপনার লেকচার নোট লিখুন..." 
                  value={data.content || ''} 
                  onChange={Eisen => setData(prev => ({...prev, content: Eisen.target.value}))} 
                  className="min-h-[600px] text-base leading-relaxed font-bold border-none focus-visible:ring-0 shadow-none px-0" 
                  style={{ lineHeight: '1.2' }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {isPrintMode && (
        <div className="print-view-container flex flex-col h-screen fixed inset-0 top-0 left-0 bg-slate-100 z-[9999] font-kalpurush overflow-hidden">
          <header className="no-print h-14 bg-white border-b flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center"><Eye className="w-5 h-5" /></div>
                <h3 className="font-bold text-lg">প্রিন্ট প্রিভিউ ও লেআউট (মোট {toBengaliNumber(paginatedPages.length)} পাতা)</h3>
             </div>
             <div className="flex gap-3">
               <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2 font-bold border-primary text-primary bg-white"><ArrowLeft className="w-4 h-4" /> এডিটরে ফিরুন</Button>
               <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 font-bold border-red-500 text-red-600 bg-white"><FileText className="w-4 h-4" /> পিডিএফ সেভ করুন</Button>
               <Button size="sm" onClick={() => window.print()} className="gap-2 font-bold bg-primary px-6 shadow-lg"><Printer className="w-4 h-4" /> প্রিন্ট করুন</Button>
             </div>
          </header>
          
          <div className="flex-1 flex overflow-hidden">
            <aside className="no-print w-80 bg-white border-r overflow-y-auto p-6 space-y-8 shrink-0 pb-32">
               <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" /> পেজ মার্জিন (ইঞ্চি)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold">উপরে (Top)</label>
                      <Input type="text" value={printSettings.marginTop} onChange={e => {
                        const val = e.target.value;
                        if (val === '' || val === '.' || !isNaN(parseFloat(val))) {
                          setPrintSettings(p => ({...p, marginTop: val}));
                        }
                      }} className="h-8 font-bold no-arrows" style={{ appearance: 'none', MozAppearance: 'textfield' }} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold">নিচে (Bottom)</label>
                      <Input type="text" value={printSettings.marginBottom} onChange={e => {
                        const val = e.target.value;
                        if (val === '' || val === '.' || !isNaN(parseFloat(val))) {
                          setPrintSettings(p => ({...p, marginBottom: val}));
                        }
                      }} className="h-8 font-bold no-arrows" style={{ appearance: 'none', MozAppearance: 'textfield' }} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold">বামে (Left)</label>
                      <Input type="text" value={printSettings.marginLeft} onChange={e => {
                        const val = e.target.value;
                        if (val === '' || val === '.' || !isNaN(parseFloat(val))) {
                          setPrintSettings(p => ({...p, marginLeft: val}));
                        }
                      }} className="h-8 font-bold no-arrows" style={{ appearance: 'none', MozAppearance: 'textfield' }} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold">ডানে (Right)</label>
                      <Input type="text" value={printSettings.marginRight} onChange={e => {
                        const val = e.target.value;
                        if (val === '' || val === '.' || !isNaN(parseFloat(val))) {
                          setPrintSettings(p => ({...p, marginRight: val}));
                        }
                      }} className="h-8 font-bold no-arrows" style={{ appearance: 'none', MozAppearance: 'textfield' }} />
                    </div>
                  </div>
               </div>

               <Separator />

               <div className="space-y-5">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> জলছাপ সেটিংস
                  </h4>
                  
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl border-2 bg-slate-50/50 space-y-4">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          id="text-wm" 
                          checked={printSettings.watermarkType === 'text'} 
                          onCheckedChange={() => setPrintSettings(p => ({...p, watermarkType: 'text'}))} 
                        />
                        <label htmlFor="text-wm" className="text-sm font-black flex items-center gap-2 cursor-pointer">
                          <Type className="w-4 h-4 text-indigo-600" /> টেক্সট জলছাপ
                        </label>
                      </div>
                      
                      {printSettings.watermarkType === 'text' && (
                        <div className="space-y-3 pt-2 animate-in fade-in duration-300">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">লেখা</label>
                            <Input value={printSettings.watermarkText} onChange={e => setPrintSettings(p => ({...p, watermarkText: e.target.value}))} placeholder="জলছাপ লেখা..." className="h-8 font-bold text-xs" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500">সাইজ (pt)</label>
                              <Input type="number" value={printSettings.watermarkFontSize} onChange={e => setPrintSettings(p => ({...p, watermarkFontSize: parseInt(e.target.value) || 0}))} className="h-8 font-bold text-xs" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500">এঙ্গেল (ডিগ্রি)</label>
                              <Input 
                                type="text" 
                                value={printSettings.watermarkRotation} 
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val === '' || val === '-' || !isNaN(parseInt(val))) {
                                    setPrintSettings(p => ({...p, watermarkRotation: val}));
                                  }
                                }} 
                                className="h-8 font-bold text-xs no-arrows" 
                                style={{ appearance: 'none', MozAppearance: 'textfield' }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl border-2 bg-slate-50/50 space-y-4">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          id="image-wm" 
                          checked={printSettings.watermarkType === 'image'} 
                          onCheckedChange={() => setPrintSettings(p => ({...p, watermarkType: 'image'}))} 
                        />
                        <label htmlFor="image-wm" className="text-sm font-black flex items-center gap-2 cursor-pointer">
                          <ImageIcon className="w-4 h-4 text-emerald-600" /> লোগো জলছাপ
                        </label>
                      </div>
                      
                      {printSettings.watermarkType === 'image' && (
                        <div className="space-y-3 pt-2 animate-in fade-in duration-300">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-8 gap-2 font-bold flex-1 bg-white" onClick={() => watermarkImageRef.current?.click()}>
                              <ImageIcon className="w-3.5 h-3.5" /> লোগো আপলোড
                            </Button>
                            {printSettings.watermarkImageUrl && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setPrintSettings(p => ({...p, watermarkImageUrl: ''}))}>
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500">এঙ্গেল (ডিগ্রি)</label>
                            <Input 
                              type="text" 
                              value={printSettings.watermarkRotation} 
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || !isNaN(parseInt(val))) {
                                  setPrintSettings(p => ({...p, watermarkRotation: val}));
                                }
                              }} 
                              className="h-8 font-bold text-xs no-arrows" 
                              style={{ appearance: 'none', MozAppearance: 'textfield' }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 flex justify-between">লোগো সাইজ (%) <span>{toBengaliNumber(printSettings.watermarkImageSize)}%</span></label>
                            <div className="pt-1">
                              <Slider value={[printSettings.watermarkImageSize]} max={100} min={10} step={1} onValueChange={([v]) => setPrintSettings(p => ({...p, watermarkImageSize: v}))} />
                            </div>
                          </div>
                          <input type="file" ref={watermarkImageRef} className="hidden" accept="image/*" onChange={handleWatermarkImage} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                      জলছাপ ব্রাইটনেস <span>{toBengaliNumber(printSettings.watermarkOpacity)}%</span>
                    </label>
                    <div className="pt-2">
                      <Slider value={[printSettings.watermarkOpacity]} max={100} step={1} onValueChange={([v]) => setPrintSettings(p => ({...p, watermarkOpacity: v}))} />
                    </div>
                  </div>
               </div>
            </aside>

            <main className="print-main-area flex-1 overflow-y-auto bg-slate-200 pt-16 pb-24 flex flex-col items-center gap-10 custom-scrollbar relative">
               {paginatedPages.map((pageHtml, idx) => {
                 const mT = parseFloat(String(printSettings.marginTop)) || 0.5;
                 const mB = parseFloat(String(printSettings.marginBottom)) || 0.5;
                 const mL = parseFloat(String(printSettings.marginLeft)) || 0.5;
                 const mR = parseFloat(String(printSettings.marginRight)) || 0.5;
                 
                 return (
                 <div 
                   key={idx}
                   className="paper shadow-2xl bg-white relative overflow-hidden shrink-0" 
                   style={{ 
                     width: '8.27in', 
                     height: '11.69in',
                     padding: `${mT}in ${mR}in ${mB}in ${mL}in`,
                     lineHeight: '1.2',
                     display: 'block'
                   }}
                 >
                    {/* Integrated Watermark into Paper Container */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden" 
                      style={{ 
                        opacity: printSettings.watermarkOpacity / 100, 
                        transform: `rotate(${parseInt(printSettings.watermarkRotation?.toString()) || 0}deg)`, 
                        whiteSpace: 'nowrap' 
                      }}
                    >
                      {printSettings.watermarkType === 'image' && printSettings.watermarkImageUrl ? (
                        <img 
                          src={printSettings.watermarkImageUrl} 
                          alt="Watermark" 
                          style={{ 
                            width: `${printSettings.watermarkImageSize || 70}%`, 
                            height: `${printSettings.watermarkImageSize || 70}%` 
                          }} 
                          className="object-contain" 
                        />
                      ) : (
                        <span 
                          style={{ fontSize: `${printSettings.watermarkFontSize}pt` }} 
                          className="font-black text-black"
                        >
                          {printSettings.watermarkText || data.institution || softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস'}
                        </span>
                      )}
                    </div>

                    {/* Integrated Header and Content into Paper Container */}
                    <div className="relative z-10 flex flex-col h-full text-black">
                      <header className="text-center border-b-2 border-black pb-1 mb-2">
                        <h1 className="font-black text-[23px] text-black leading-tight">{data.institution || softwareConfig?.appName || 'শিক্ষা প্রতিষ্ঠানের নাম'}</h1>
                        <div className="flex justify-center gap-8 text-[10pt] font-bold mt-1">
                          <span>শ্রেণি: {CLASSES.find(c => c.id === data.classId)?.label || ''} শ্রেণি</span>
                          <span>বিষয়: {data.subject}</span>
                        </div>
                      </header>
                      
                      {idx === 0 && (
                        <h2 className="text-[13pt] font-bold text-center underline uppercase mb-4">{data.topic || 'লেকচার শিট'}</h2>
                      )}

                      <div 
                        className="content-area text-[10.5pt] text-justify flex-1 font-kalpurush"
                        style={{ lineHeight: '1.2' }}
                        dangerouslySetInnerHTML={{ __html: pageHtml }}
                      />
                      
                      <footer className="mt-auto pt-4 flex justify-between text-[9pt] font-bold border-t border-slate-200">
                        <span>পাতা: {toBengaliNumber(idx + 1)} / {toBengaliNumber(paginatedPages.length)}</span>
                        <span>{softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস'}</span>
                      </footer>
                    </div>
                 </div>
               )})}
            </main>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
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
          .paper { color: black !important; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          
          input.no-arrows::-webkit-outer-spin-button,
          input.no-arrows::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input.no-arrows {
            -moz-appearance: textfield;
          }
        }
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-view-container { 
            position: static !important; 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important; 
            background: white !important;
            z-index: auto !important;
          }
          .print-view-container > div {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
          }
          .print-main-area { 
            background: white !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            overflow: visible !important; 
            display: block !important; 
            height: auto !important;
            position: static !important;
          }
          .paper { 
            position: relative !important; 
            margin: 0 !important; 
            box-shadow: none !important; 
            width: 8.27in !important; 
            height: 11.69in !important; 
            break-after: page; 
            break-inside: avoid;
            display: block !important;
            visibility: visible !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          @page { size: A4; margin: 0; }
        }
      `}} />
    </div>
  );
}

export default function CreateLectureSheetPage() { return <Suspense fallback={<div className="flex justify-center p-20 font-kalpurush"><Loader2 className="animate-spin text-primary" /></div>}><CreateLectureSheetContent /></Suspense>; }
