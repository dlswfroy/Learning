
"use client";

import { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Save, FileText, ArrowLeft, Loader2, BookOpen, ScanText, Eye, Settings2, SlidersHorizontal, Image as ImageIcon, X, Type, Bold, Underline, Rows3, AlignLeft, AlignCenter, AlignRight, AlignJustify, Edit3, FileDown, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import Tesseract from 'tesseract.js';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function formatMath(text: string) {
  if (!text) return '';
  // Remove all $ signs and LaTeX delimiters from Gemini output to keep formulas clean
  let formatted = text.replace(/\$|\\\(|\\\)|\\\[|\\\]/g, '');
  
  formatted = formatted.replace(/\(\((.*?)\)\)/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
  
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
    '\\\\left': '', '\\\\right': '', '\\\\\%': '%', '\\\\setminus': '\\', '\\\\backslash': '\\',
    '\\\\propto': '∝', '\\\\parallel': '∥', '\\\\perp': '⊥'
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
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('id');
  const isPrintMode = searchParams.get('print') === 'true';
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
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
    watermarkOpacity: 10,
    watermarkText: '',
    watermarkFontSize: 80,
    watermarkRotation: -45,
    watermarkImageUrl: '',
    watermarkImageSize: 70,
    watermarkType: 'text'
  });

  const [paginatedPages, setPaginatedPages] = useState<string[]>([]);
  const [pageStyles, setPageStyles] = useState<Record<number, any>>({});
  const [activeEditIdx, setActiveEditIdx] = useState<number | null>(null);
  const [manualPages, setManualPages] = useState<Record<number, string>>({});
  const [globalFontSize, setGlobalFontSize] = useState(10.5);
  const [globalLineHeight, setGlobalLineHeight] = useState(1.2);

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
          setData({
            institution: docData.institution || 'টপ গ্রেড টিউটোরিয়ালস',
            classId: docData.classId || '',
            subject: docData.subject || '',
            topic: docData.topic || '',
            content: docData.content || '',
            type: docData.type || 'written'
          });
          if (docData.printSettings) setPrintSettings(prev => ({ ...prev, ...docData.printSettings }));
          if (docData.pageStyles) {
            setPageStyles(docData.pageStyles);
            if (docData.pageStyles[0]?.fontSize) setGlobalFontSize(docData.pageStyles[0].fontSize);
            if (docData.pageStyles[0]?.lineHeight) setGlobalLineHeight(docData.pageStyles[0].lineHeight);
          }
          if (docData.manualPages) setManualPages(docData.manualPages);
        }
      } catch (e) {} finally { setLoading(false); }
    }
    if (user && db) loadSheet();
  }, [editId, db, user, router]);

  useEffect(() => {
    if (!isPrintMode) return;

    // Check if we should restore from manualPages or re-paginate from editor content
    if (Object.keys(manualPages).length > 0 && paginatedPages.length === 0) {
      const sortedIndices = Object.keys(manualPages).map(Number).sort((a, b) => a - b);
      const restoredPages = sortedIndices.map(idx => manualPages[idx]);
      
      // Smart check: if the editor content is significantly different from manual pages, re-paginate
      const editorText = data.content.replace(/<[^>]*>/g, '').replace(/\s/g, '');
      const manualCombinedText = restoredPages.join('').replace(/<[^>]*>/g, '').replace(/\s|&nbsp;/g, '');
      
      if (Math.abs(editorText.length - manualCombinedText.length) < 15) {
        setPaginatedPages(restoredPages);
        return;
      }
      // If content is different, fall through to re-pagination logic
    }

    if (data.content && measurementRef.current) {
      const container = measurementRef.current;
      const contentHtml = formatMath(data.content);
      
      const mT = parseFloat(String(printSettings.marginTop)) || 0.5;
      const mB = parseFloat(String(printSettings.marginBottom)) || 0.5;
      const mL = parseFloat(String(printSettings.marginLeft)) || 0.5;
      const mR = parseFloat(String(printSettings.marginRight)) || 0.5;

      container.style.width = (8.27 - mL - mR) + 'in';
      container.style.fontFamily = 'Kalpurush, sans-serif';
      container.style.fontSize = globalFontSize + 'pt';
      container.style.lineHeight = String(globalLineHeight);
      
      const tempLines = contentHtml.split('\n');
      const lineHtml = tempLines.map(line => `<div class="measure-line" style="min-height: 1.2em;">${line.trim() || '&nbsp;'}</div>`).join('');
      container.innerHTML = lineHtml;
      
      const headerSpace = 135; 
      const footerSpace = 65;  
      const topicSpacePx = 65; 
      const totalPageHeightPx = 11.69 * 96; 
      const availableHeightPx = totalPageHeightPx - (mT * 96) - (mB * 96) - headerSpace - footerSpace;
      
      const newPages: string[] = [];
      let currentChunk = "";
      let currentHeight = 0;

      const lines = container.querySelectorAll('.measure-line');
      lines.forEach((line) => {
        const h = (line as HTMLElement).offsetHeight || 18; 
        const effectiveLimit = (newPages.length === 0) ? (availableHeightPx - topicSpacePx) : availableHeightPx;

        if (currentHeight > 0 && currentHeight + h > effectiveLimit) {
          if (currentChunk.trim() !== "") newPages.push(currentChunk);
          currentChunk = line.innerHTML + "<br/>";
          currentHeight = h;
        } else {
          currentChunk += line.innerHTML + "<br/>";
          currentHeight += h;
        }
      });
      
      if (currentChunk.trim() !== "") newPages.push(currentChunk);
      
      const finalPages = newPages.filter(p => {
        const textContent = p.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
        return textContent.length > 0;
      });

      const pagesToRender = finalPages.length > 0 ? finalPages : [""];
      setPaginatedPages(pagesToRender);
      
      const initialStyles: Record<number, any> = {};
      const initialManual: Record<number, string> = {};
      pagesToRender.forEach((p, i) => {
         initialStyles[i] = { fontSize: globalFontSize, lineHeight: globalLineHeight, bold: false, underline: false, color: '#000000', align: 'justify', mT, mB, mL, mR };
         initialManual[i] = p;
      });
      
      setPageStyles(initialStyles);
      setManualPages(initialManual);
    }
  }, [isPrintMode, data.content, printSettings, globalFontSize, globalLineHeight]);

  const subjects = useMemo(() => data.classId ? getSubjectsForClass(data.classId) : [], [data.classId]);

  const handleSave = useCallback(() => {
    if (!user || !db) return;
    
    let currentManualPages = { ...manualPages };
    const activeEl = document.activeElement;
    if (activeEl && activeEl.getAttribute('contenteditable') === 'true') {
      const paper = activeEl.closest('.paper');
      if (paper) {
        const match = paper.className.match(/paper-idx-(\d+)/);
        if (match) {
          const idx = parseInt(match[1]);
          const currentHTML = (activeEl as HTMLElement).innerHTML || "";
          currentManualPages[idx] = currentHTML;
        }
      }
    }

    setSaving(true);
    const docId = editId || doc(collection(db, 'lecture-sheets')).id;
    const ref = doc(db, 'lecture-sheets', docId);
    
    const payload: any = { 
      ...data, 
      printSettings, 
      pageStyles, 
      manualPages: currentManualPages, 
      userId: user.uid, 
      updatedAt: serverTimestamp() 
    };
    if (!editId) payload.createdAt = serverTimestamp();

    setDoc(ref, payload, { merge: true })
      .then(() => { 
        setSaving(false); 
        setManualPages(currentManualPages);
        const sortedIndices = Object.keys(currentManualPages).map(Number).sort((a, b) => a - b);
        setPaginatedPages(sortedIndices.map(idx => currentManualPages[idx]));
        
        toast({ title: "সফল!", description: "লেকচার শিট সরাসরি সেভ হয়েছে।" }); 
        if (!editId) router.replace(`/create-lecture-sheet?id=${docId}`); 
      })
      .catch(async (error) => { 
        setSaving(false); 
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: ref.path, 
          operation: 'write', 
          requestResourceData: payload 
        })); 
      });
  }, [user, db, editId, data, printSettings, pageStyles, manualPages, router, toast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const result = await Tesseract.recognize(file, 'ben+eng');
      if (result?.data?.text) {
        setData(prev => ({ ...prev, content: prev.content ? prev.content + '\n\n' + result.data.text : result.data.text }));
        toast({ title: "সফল!", description: "টেক্সট এক্সট্রাক্ট করা হয়েছে।" });
      }
    } catch (error) { toast({ variant: "destructive", title: "স্ক্যান ব্যর্থ হয়েছে" }); }
    finally { setIsScanning(false); if (ocrInputRef.current) ocrInputRef.current.value = ''; }
  };

  const updatePageStyle = (idx: number, key: string, val: any) => {
    setPageStyles(prev => ({ ...prev, [idx]: { ...prev[idx], [key]: val } }));
  };

  const handleGlobalFontSizeChange = (size: number) => {
    setGlobalFontSize(size);
    setPageStyles(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(idx => {
        updated[parseInt(idx)] = { ...updated[parseInt(idx)], fontSize: size };
      });
      return updated;
    });
  };

  const handleGlobalLineHeightChange = (val: number) => {
    setGlobalLineHeight(val);
    setPageStyles(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(idx => {
        updated[parseInt(idx)] = { ...updated[parseInt(idx)], lineHeight: val };
      });
      return updated;
    });
  };

  const handleFormatting = (command: string, value: string | null = null) => {
    const selection = window.getSelection();
    const hasSelection = selection && selection.rangeCount > 0 && !selection.isCollapsed;

    if (hasSelection) {
      document.execCommand('styleWithCSS', false, 'true');
      if (command === 'fontSize') {
        document.execCommand('styleWithCSS', false, 'false');
        document.execCommand('fontSize', false, '7');
        const editableDiv = document.querySelector(`.paper-idx-${activeEditIdx} .content-area`) as HTMLElement;
        if (editableDiv) {
          const fonts = editableDiv.querySelectorAll('font[size="7"]');
          fonts.forEach(font => {
            font.removeAttribute('size');
            font.style.fontSize = value + 'pt';
          });
        }
        document.execCommand('styleWithCSS', false, 'true');
      } else if (command === 'lineHeight') {
        const range = selection.getRangeAt(0);
        if (range) {
          const span = document.createElement('span');
          span.style.lineHeight = value + '';
          span.style.display = 'inline-block';
          span.appendChild(range.extractContents());
          range.insertNode(span);
        }
      } else {
        document.execCommand(command, false, value || '');
      }
    } else if (activeEditIdx !== null) {
      if (command === 'fontSize') updatePageStyle(activeEditIdx, 'fontSize', parseFloat(value || '10.5'));
      if (command === 'lineHeight') updatePageStyle(activeEditIdx, 'lineHeight', parseFloat(value || '1.2'));
      if (command === 'bold') updatePageStyle(activeEditIdx, 'bold', !pageStyles[activeEditIdx].bold);
      if (command === 'underline') updatePageStyle(activeEditIdx, 'underline', !pageStyles[activeEditIdx].underline);
      if (command === 'foreColor') updatePageStyle(activeEditIdx, 'color', value);
      if (command.startsWith('justify')) {
        const alignMap: any = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' };
        updatePageStyle(activeEditIdx, 'align', alignMap[command]);
      }
    }
  };

  const handleDeletePage = (idx: number) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই পাতাটি মুছে ফেলতে চান?")) return;
    
    const newPaginated = paginatedPages.filter((_, i) => i !== idx);
    setPaginatedPages(newPaginated);
    
    setManualPages(prev => {
      const next: Record<number, string> = {};
      newPaginated.forEach((content, i) => {
        const oldIdx = i < idx ? i : i + 1;
        if (prev[oldIdx] !== undefined) {
          next[i] = prev[oldIdx];
        } else {
          next[i] = content;
        }
      });
      return next;
    });

    setPageStyles(prev => {
      const next: Record<number, any> = {};
      newPaginated.forEach((_, i) => {
        const oldIdx = i < idx ? i : i + 1;
        if (prev[oldIdx]) {
          next[i] = prev[oldIdx];
        }
      });
      return next;
    });

    if (activeEditIdx === idx) setActiveEditIdx(null);
    else if (activeEditIdx !== null && activeEditIdx > idx) setActiveEditIdx(activeEditIdx - 1);
    
    toast({ title: "সফল", description: "পাতাটি মুছে ফেলা হয়েছে।" });
  };

  if (loading || userLoading) return <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]"><Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /><p className="font-bold">অ্যাক্সেস চেক করা হচ্ছে...</p></div>;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-32 font-kalpurush">
      <div ref={measurementRef} className="fixed invisible pointer-none whitespace-pre-wrap text-[10.5pt] font-kalpurush" style={{ width: '7.27in', lineHeight: '1.2' }} />

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
                  <Input value={data.institution || ''} onChange={e => setData(prev => ({...prev, institution: e.target.value}))} />
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
                  <label className="text-sm font-semibold">টপিক / শিরোনাম</label>
                  <Input value={data.topic || ''} onChange={e => setData(prev => ({...prev, topic: e.target.value}))} placeholder="যেমন: ৩য় অধ্যায়" />
                </div>
                <div className="pt-4 border-t">
                  <input type="file" ref={ocrInputRef} className="hidden" accept="image/*" onChange={handleOCR} />
                  <Button onClick={() => ocrInputRef.current?.click()} disabled={isScanning} variant="outline" className="w-full gap-2 border-indigo-600 text-indigo-700 font-bold">
                    {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />} এআই স্ক্যান
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-3">
              <Button onClick={handleSave} disabled={saving} className="w-full gap-2 font-bold h-11"><Save className="w-4 h-4" /> সেভ করুন (Ctrl+S)</Button>
              <Button onClick={() => { if(!data.content) return; const p = new URLSearchParams(window.location.search); p.set('print', 'true'); if(editId) p.set('id', editId); router.push(`${window.location.pathname}?${p.toString()}`); }} variant="outline" className="w-full gap-2 border-primary text-primary font-bold h-11"><Eye className="w-4 h-4" /> প্রিন্ট ভিউ</Button>
            </div>
          </aside>
          <div className="flex-1 w-full">
            <Card className="shadow-sm border-primary/5">
              <CardContent className="pt-6">
                <label className="text-sm font-bold text-primary flex items-center gap-2 mb-4 border-b pb-2"><BookOpen className="w-4 h-4" /> কন্টেন্ট এডিটর</label>
                <Textarea placeholder="এখানে আপনার লেকচার নোট লিখুন..." value={data.content || ''} onChange={e => setData(prev => ({...prev, content: e.target.value}))} className="min-h-[600px] text-base leading-relaxed font-bold border-none focus-visible:ring-0 shadow-none px-0" />
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
               <Button variant="outline" size="sm" onMouseDown={e => e.preventDefault()} onClick={() => router.back()} className="gap-2 font-bold border-primary text-primary bg-white"><ArrowLeft className="w-4 h-4" /> এডিটরে ফিরুন</Button>
               <Button variant="outline" size="sm" onMouseDown={e => e.preventDefault()} onClick={() => window.print()} className="gap-2 font-bold text-red-600 bg-white border-red-200"><FileDown className="w-4 h-4" /> পিডিএফ সেভ করুন</Button>
               <Button size="sm" onMouseDown={e => e.preventDefault()} onClick={handleSave} disabled={saving} className="gap-2 font-bold bg-green-600 hover:bg-green-700 px-4"><Save className="w-4 h-4" /> সেভ (Ctrl+S)</Button>
               <Button size="sm" onMouseDown={e => e.preventDefault()} onClick={() => window.print()} className="gap-2 font-bold bg-primary px-6"><Printer className="w-4 h-4" /> প্রিন্ট করুন</Button>
             </div>
          </header>
          
          <div className="flex-1 flex overflow-hidden">
            <aside className="no-print w-80 bg-white border-r overflow-y-auto p-6 space-y-8 shrink-0 pb-32 custom-scrollbar">
               {activeEditIdx !== null && pageStyles[activeEditIdx] ? (
                 <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-blue-600 uppercase flex items-center gap-2"><Edit3 className="w-3.5 h-3.5" /> পাতা {toBengaliNumber(activeEditIdx + 1)} টুলস</h4>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onMouseDown={e => e.preventDefault()} onClick={() => setActiveEditIdx(null)}><X className="w-3 h-3" /></Button>
                    </div>

                    <div className="p-4 rounded-xl border-2 border-blue-100 bg-blue-50/30 space-y-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase">পেজ মার্জিন (ইঞ্চি)</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><label className="text-[9px] font-bold">উপরে</label><Input type="text" value={pageStyles[activeEditIdx].mT} onChange={e => updatePageStyle(activeEditIdx!, 'mT', e.target.value)} onMouseDown={e => e.stopPropagation()} className="h-7 text-xs font-bold no-arrows" /></div>
                          <div className="space-y-1"><label className="text-[9px] font-bold">নিচে</label><Input type="text" value={pageStyles[activeEditIdx].mB} onChange={e => updatePageStyle(activeEditIdx!, 'mB', e.target.value)} onMouseDown={e => e.stopPropagation()} className="h-7 text-xs font-bold no-arrows" /></div>
                          <div className="space-y-1"><label className="text-[9px] font-bold">বামে</label><Input type="text" value={pageStyles[activeEditIdx].mL} onChange={e => updatePageStyle(activeEditIdx!, 'mL', e.target.value)} onMouseDown={e => e.stopPropagation()} className="h-7 text-xs font-bold no-arrows" /></div>
                          <div className="space-y-1"><label className="text-[9px] font-bold">ডানে</label><Input type="text" value={pageStyles[activeEditIdx].mR} onChange={e => updatePageStyle(activeEditIdx!, 'mR', e.target.value)} onMouseDown={e => e.stopPropagation()} className="h-7 text-xs font-bold no-arrows" /></div>
                        </div>
                      </div>

                      <Separator className="bg-blue-100" />

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 flex justify-between">ফন্ট সাইজ (pt) <span>{toBengaliNumber(pageStyles[activeEditIdx].fontSize)}pt</span></label>
                        <Slider 
                          value={[pageStyles[activeEditIdx].fontSize]} 
                          min={8} max={24} step={0.5} 
                          onMouseDown={(e) => e.preventDefault()}
                          onValueChange={([v]) => handleFormatting('fontSize', v.toString())} 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 flex justify-between">লাইন স্পেসিং <span>{toBengaliNumber(pageStyles[activeEditIdx].lineHeight)}</span></label>
                        <Slider 
                          value={[pageStyles[activeEditIdx].lineHeight]} 
                          min={1.0} max={3.0} step={0.1} 
                          onMouseDown={(e) => e.preventDefault()}
                          onValueChange={([v]) => handleFormatting('lineHeight', v.toString())} 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">টেক্সট স্টাইল</label>
                        <div className="flex gap-2">
                          <Button 
                            variant={pageStyles[activeEditIdx].bold ? 'default' : 'outline'} 
                            size="icon" className="h-8 w-8" 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleFormatting('bold')}
                          >
                            <Bold className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant={pageStyles[activeEditIdx].underline ? 'default' : 'outline'} 
                            size="icon" className="h-8 w-8" 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleFormatting('underline')}
                          >
                            <Underline className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">রং (Color)</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="color" value={pageStyles[activeEditIdx].color} 
                            onMouseDown={(e) => e.preventDefault()}
                            onChange={(e) => handleFormatting('foreColor', e.target.value)}
                            className="w-10 h-8 rounded border-0 cursor-pointer p-0"
                          />
                          <span className="text-[10px] font-mono font-bold uppercase">{pageStyles[activeEditIdx].color}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">বিন্যাস (Alignment)</label>
                        <div className="grid grid-cols-4 gap-1">
                          {['left', 'center', 'right', 'justify'].map(a => {
                             const command = a === 'justify' ? 'justifyFull' : `justify${a.charAt(0).toUpperCase() + a.slice(1)}`;
                             return (
                            <Button 
                              key={a} variant={pageStyles[activeEditIdx!].align === a ? 'secondary' : 'ghost'} 
                              size="icon" className="h-8 w-full" 
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => handleFormatting(command)}
                            >
                              {a === 'left' && <AlignLeft className="w-4 h-4" />}
                              {a === 'center' && <AlignCenter className="w-4 h-4" />}
                              {a === 'right' && <AlignRight className="w-4 h-4" />}
                              {a === 'justify' && <AlignJustify className="w-4 h-4" />}
                            </Button>
                          )})}
                        </div>
                      </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-8 animate-in fade-in duration-500">
                   <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><Type className="w-3.5 h-3.5" /> গ্লোবাল ফন্ট সাইজ</h4>
                      <div className="p-4 rounded-xl border-2 border-slate-100 bg-slate-50/30 space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ফন্ট সাইজ (pt)</label>
                          <span className="text-xs font-black text-primary">{toBengaliNumber(globalFontSize)}pt</span>
                        </div>
                        <Slider 
                          value={[globalFontSize]} 
                          min={8} max={24} step={0.5} 
                          onMouseDown={(e) => e.preventDefault()}
                          onValueChange={([v]) => handleGlobalFontSizeChange(v)} 
                        />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><Rows3 className="w-3.5 h-3.5" /> গ্লোবাল লাইন স্পেসিং</h4>
                      <div className="p-4 rounded-xl border-2 border-slate-100 bg-slate-50/30 space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">লাইন স্পেসিং</label>
                          <span className="text-xs font-black text-primary">{toBengaliNumber(globalLineHeight)}</span>
                        </div>
                        <Slider 
                          value={[globalLineHeight]} 
                          min={1.0} max={3.0} step={0.1} 
                          onMouseDown={(e) => e.preventDefault()}
                          onValueChange={([v]) => handleGlobalLineHeightChange(v)} 
                        />
                      </div>
                   </div>

                   <Separator />

                   <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><Settings2 className="w-3.5 h-3.5" /> গ্লোবাল মার্জিন</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-bold">উপরে</label><Input type="text" value={printSettings.marginTop} onChange={e => setPrintSettings(p => ({...p, marginTop: e.target.value}))} onMouseDown={e => e.stopPropagation()} className="h-8 font-bold no-arrows" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold">নিছে</label><Input type="text" value={printSettings.marginBottom} onChange={e => setPrintSettings(p => ({...p, marginBottom: e.target.value}))} onMouseDown={e => e.stopPropagation()} className="h-8 font-bold no-arrows" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold">বামে</label><Input type="text" value={printSettings.marginLeft} onChange={e => setPrintSettings(p => ({...p, marginLeft: e.target.value}))} onMouseDown={e => e.stopPropagation()} className="h-8 font-bold no-arrows" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold">ডানে</label><Input type="text" value={printSettings.marginRight} onChange={e => setPrintSettings(p => ({...p, marginRight: e.target.value}))} onMouseDown={e => e.stopPropagation()} className="h-8 font-bold no-arrows" /></div>
                      </div>
                   </div>

                   <Separator />

                   <div className="space-y-5">
                      <h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><SlidersHorizontal className="w-3.5 h-3.5" /> জলছাপ সেটিংস</h4>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          {['text', 'image'].map(t => (
                            <Button 
                              key={t}
                              variant={printSettings.watermarkType === t ? 'default' : 'outline'}
                              className="flex-1 h-10 gap-2 font-bold text-[10px]"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => setPrintSettings(p => ({...p, watermarkType: t}))}
                            >
                              {t === 'text' ? <Type className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                              {t === 'text' ? 'টেক্সট' : 'লোগো'}
                            </Button>
                          ))}
                        </div>

                        {printSettings.watermarkType === 'text' ? (
                          <div className="p-4 rounded-xl border-2 bg-slate-50/50 space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">জলছাপ টেক্সট</label>
                            <Input value={printSettings.watermarkText} onChange={e => setPrintSettings(p => ({...p, watermarkText: e.target.value}))} onMouseDown={e => e.stopPropagation()} className="h-8 text-xs font-bold" placeholder="প্রতিষ্ঠানের নাম" />
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border-2 bg-slate-50/50 space-y-4">
                            <div className="flex items-center gap-2">
                              <input type="file" ref={watermarkImageRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setPrintSettings(p => ({ ...p, watermarkImageUrl: ev.target?.result as string, watermarkType: 'image' })); r.readAsDataURL(f); } }} />
                              <Button onClick={() => watermarkImageRef.current?.click()} onMouseDown={e => e.preventDefault()} variant="outline" className="flex-1 h-9 gap-2 font-bold text-xs border-dashed border-2">
                                <ImageIcon className="w-3.5 h-3.5" /> লোগো আপলোড
                              </Button>
                              {printSettings.watermarkImageUrl && (
                                <Button onClick={() => setPrintSettings(p => ({...p, watermarkImageUrl: ''}))} onMouseDown={e => e.preventDefault()} variant="ghost" size="icon" className="h-9 w-9 text-destructive">
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-4 pt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">জলছাপ এঙ্গেল</label>
                            <Input type="text" value={printSettings.watermarkRotation} onChange={e => setPrintSettings(p => ({...p, watermarkRotation: e.target.value}))} onMouseDown={e => e.stopPropagation()} className="h-8 font-bold no-arrows" />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center"><label className="text-[10px] font-bold text-slate-500 uppercase">জলছাপ সাইজ (%)</label><span className="text-[10px] font-bold">{toBengaliNumber(printSettings.watermarkImageSize)}%</span></div>
                            <Slider value={[printSettings.watermarkImageSize]} min={10} max={200} step={1} onMouseDown={e => e.preventDefault()} onValueChange={([v]) => setPrintSettings(p => ({...p, watermarkImageSize: v}))} />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center"><label className="text-[10px] font-bold text-slate-500 uppercase">জলছাপ ব্রাইটনেস</label><span className="text-[10px] font-bold">{toBengaliNumber(printSettings.watermarkOpacity)}%</span></div>
                            <Slider value={[printSettings.watermarkOpacity]} min={0} max={100} step={1} onMouseDown={e => e.preventDefault()} onValueChange={([v]) => setPrintSettings(p => ({...p, watermarkOpacity: v}))} />
                          </div>
                        </div>
                      </div>
                   </div>
                 </div>
               )}
            </aside>

            <main className="print-main-area flex-1 overflow-y-auto bg-slate-200 pt-16 pb-24 flex flex-col items-center gap-10 relative">
               {paginatedPages.map((pageHtml, idx) => {
                 const style = pageStyles[idx] || { fontSize: globalFontSize, lineHeight: globalLineHeight, bold: false, underline: false, color: '#000000', align: 'justify', mT: 0.5, mB: 0.5, mL: 0.5, mR: 0.5 };
                 const mT = parseFloat(String(style.mT)) || 0.5;
                 const mB = parseFloat(String(style.mB)) || 0.5;
                 const mL = parseFloat(String(style.mL)) || 0.5;
                 const mR = parseFloat(String(style.mR)) || 0.5;

                 return (
                 <div 
                   key={idx} className={cn(`paper paper-idx-${idx} shadow-2xl bg-white relative overflow-hidden shrink-0 group transition-all`, activeEditIdx === idx && "ring-4 ring-blue-500 shadow-blue-200")}
                   style={{ width: '8.27in', height: '11.69in', padding: `${mT}in ${mR}in ${mB}in ${mL}in`, lineHeight: '1.2', boxSizing: 'border-box' }}
                 >
                    <div className="no-print absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 flex gap-2">
                      <Button size="sm" variant={activeEditIdx === idx ? 'default' : 'secondary'} className="gap-2 font-bold shadow-lg" onClick={() => setActiveEditIdx(idx)}><Edit3 className="w-3.5 h-3.5" /> এডিট করুন</Button>
                      <Button size="sm" variant="destructive" className="gap-2 font-bold shadow-lg" onClick={() => handleDeletePage(idx)}><Trash2 className="w-3.5 h-3.5" /> মুছে ফেলুন</Button>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden" style={{ opacity: (printSettings.watermarkOpacity || 0) / 100, transform: `rotate(${printSettings.watermarkRotation || 0}deg)`, whiteSpace: 'nowrap' }}>
                      {printSettings.watermarkType === 'image' && printSettings.watermarkImageUrl ? (
                        <img src={printSettings.watermarkImageUrl} alt="Watermark" style={{ width: `${printSettings.watermarkImageSize || 70}%`, height: 'auto', objectFit: 'contain' }} />
                      ) : (
                        <span className="font-black text-black" style={{ fontSize: `${(printSettings.watermarkImageSize || 80) * 1.2}pt` }}>
                          {printSettings.watermarkText || data.institution || softwareConfig?.appName || 'টপ গ্রেড'}
                        </span>
                      )}
                    </div>
                    <div className="relative z-10 flex flex-col h-full text-black">
                      <header className="text-center border-b-2 border-black pb-1 mb-2">
                        <h1 className="font-black text-[23px] text-black leading-tight">{data.institution || softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস'}</h1>
                        <div className="flex justify-center gap-8 text-[10pt] font-bold mt-1"><span>শ্রেণি: {CLASSES.find(c => c.id === data.classId)?.label || ''} শ্রেণি</span><span>বিষয়: {data.subject}</span></div>
                      </header>
                      {idx === 0 && <h2 className="text-[13pt] font-bold text-center underline uppercase mb-4">{data.topic || 'লেকচার শিট'}</h2>}
                      <div 
                        contentEditable={activeEditIdx === idx} 
                        onBlur={(e) => {
                          const htmlValue = e.currentTarget?.innerHTML || "";
                          setManualPages(prev => ({ ...prev, [idx]: htmlValue }));
                        }}
                        className={cn("content-area flex-1 font-kalpurush outline-none", activeEditIdx === idx && "bg-blue-50/20 p-1 rounded border border-dashed border-blue-300")}
                        style={{ lineHeight: String(style.lineHeight), fontSize: `${style.fontSize}pt`, fontWeight: style.bold ? 'bold' : 'normal', textDecoration: style.underline ? 'underline' : 'none', color: style.color, textAlign: style.align as any }}
                        dangerouslySetInnerHTML={{ __html: manualPages[idx] || pageHtml }}
                      />
                      <footer className="mt-auto pt-4 flex justify-between text-[9pt] font-bold border-t border-slate-200"><span>পাতা: {toBengaliNumber(idx + 1)} / {toBengaliNumber(paginatedPages.length)}</span><span>{softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস'}</span></footer>
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
          .math-sup { font-size: 0.7em; vertical-align: super; display: inline-block; }
          .math-sub { font-size: 0.7em; vertical-align: sub; display: inline-block; }
          .math-text { font-family: 'Kalpurush', sans-serif; font-style: normal; }
          .paper { color: black !important; overflow: hidden; }
          .no-arrows::-webkit-inner-spin-button, .no-arrows::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          .no-arrows { -moz-appearance: textfield; }
          .print-view-container { top: 0 !important; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        }
        @media print {
          html, body { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            height: auto !important; 
            overflow: visible !important; 
            width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .print-view-container { 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important; 
            background: white !important; 
            width: 100% !important;
          }
          .print-main-area { 
            background: white !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            overflow: visible !important; 
            display: block !important; 
            height: auto !important; 
            position: static !important; 
            width: 100% !important;
          }
          .paper { 
            position: relative !important; 
            margin: 0 !important; 
            box-shadow: none !important; 
            width: 8.27in !important; 
            height: 11.69in !important; 
            page-break-after: always !important;
            break-after: page !important;
            break-inside: avoid !important;
            display: block !important; 
            box-sizing: border-box !important; 
            border: none !important; 
            overflow: hidden !important;
          }
          @page { 
            size: A4; 
            margin: 0 !important; 
          }
        }
      `}} />
    </div>
  );
}

export default function CreateLectureSheetPage() { return <Suspense fallback={<div className="flex justify-center p-20 font-kalpurush"><Loader2 className="animate-spin text-primary" /></div>}><CreateLectureSheetContent /></Suspense>; }
