
"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Printer, 
  Plus, 
  Trash2, 
  BookOpen, 
  Save, 
  FileText, 
  ArrowLeft, 
  Loader2, 
  Image as ImageIcon, 
  X, 
  ScanText, 
  CheckCircle2,
  BrainCircuit,
  Search,
  Layers,
  LayoutGrid,
  Eye
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import Tesseract from 'tesseract.js';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';

type Question = {
  id: string;
  type: 'creative' | 'short' | 'mcq';
  content: string;
  imageUrl?: string;
  isFromBank?: boolean;
  section?: string;
};

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function formatMath(text: string) {
  if (!text) return '';
  let formatted = text.replace(/\$|\\\(|\\\)|\\\[|\\\]|###|\*\*/g, '');
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
  Object.entries(symbolMap).forEach(([key, val]) => { formatted = formatted.replace(new RegExp(key, 'g'), val); });
  formatted = formatted.replace(/\\dot\{([^}]+)\}/g, '<span class="math-dot">$1</span>');
  formatted = formatted.replace(/\\/g, '');
  return formatted;
}

function CreateQuestionContent() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('id');
  const source = searchParams.get('source');
  const isPrintMode = searchParams.get('print') === 'true';
  
  const [loading, setLoading] = useState(!!editId || source === 'merge');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'sample' | 'exam'>('sample');
  
  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';
  
  const [meta, setMeta] = useState({
    institution: 'টপ গ্রেড টিউটোরিয়ালস', 
    exam: 'সাপ্তাহিক পরীক্ষা', 
    examType: 'creative',
    chapter: '', 
    classId: '', 
    subject: '', 
    time: '২ ঘণ্টা ৩০ মিনিট', 
    totalMarks: '১০০',
    creativeInstruction: 'যেকোনো ৭টি প্রশ্নের উত্তর দাও', 
    shortInstruction: 'সকল প্রশ্নের উত্তর দাও',
    mcqInstruction: 'সঠিক উত্তরের বিপরীতের বৃত্তটি বল পয়েন্ট কলম দ্বারা ভরাট কর। সকল প্রশ্নের উত্তর দিতে হবে। প্রশ্নপত্রে কোন প্রকার দাগ দেওয়া যাবে না।', 
    marksA: 1, marksB: 2, marksC: 3, marksD: 4, shortMarks: 2, mcqMarks: 1,
    currentSection: ''
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editId && source !== 'merge') {
      const classIdParam = searchParams.get('classId');
      const subjectParam = searchParams.get('subject');
      const chapterParam = searchParams.get('chapter');
      const typeParam = searchParams.get('type');
      if (classIdParam || subjectParam || chapterParam) { setMeta(prev => ({ ...prev, classId: classIdParam || prev.classId, subject: subjectParam || prev.subject, chapter: chapterParam || prev.chapter, examType: typeParam || 'creative' })); }
      if (typeParam === 'creative' || typeParam === 'mcq' || typeParam === 'short') { setQuestions([{ id: Math.random().toString(36).substr(2, 9), type: typeParam === 'mcq' ? 'mcq' : (typeParam === 'creative' ? 'creative' : 'short'), content: '', imageUrl: '', section: '' }]); }
    }
  }, [searchParams, editId, source]);

  useEffect(() => { if (!userLoading && !user) router.push('/auth'); }, [user, userLoading, router]);
  
  useEffect(() => {
    async function loadQuestions() {
      if (!db || !user) return;
      if (editId) {
        try {
          const docRef = doc(db, 'questions', editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMeta(prev => ({ ...prev, ...data }));
            const reconstructed = (data.questions || []).map((q: any) => {
              const id = Math.random().toString(36).substr(2, 9);
              const commonFields = { id, type: q.type, imageUrl: q.imageUrl || '', section: q.section || '' };
              if (q.type === 'mcq') return { ...commonFields, content: `${q.mcqQuestion || ''}\nক. ${q.optA || ''}\nখ. ${q.optB || ''}\nগ. ${q.optC || ''}\nঘ. ${q.optD || ''}`.trim() };
              if (q.type === 'creative') return { ...commonFields, content: `${q.stimulus || ''}\nক. ${q.qA || ''}\nখ. ${q.qB || ''}\nগ. ${q.qC || ''}\nঘ. ${q.qD || ''}`.trim() };
              return { ...commonFields, content: (q.shortText || '').trim() };
            });
            setQuestions(reconstructed);
          }
        } catch (e) {} finally { setLoading(false); }
      } else if (source === 'merge') {
        const stored = sessionStorage.getItem('merged_questions_data');
        if (stored) {
          const mergedData = JSON.parse(stored);
          const reconstructed = mergedData.map((q: any) => {
            const id = Math.random().toString(36).substr(2, 9);
            const commonFields = { id, type: q.type, imageUrl: q.imageUrl || '', section: q.section || '' };
            if (q.type === 'mcq') return { ...commonFields, content: `${q.mcqQuestion || ''}\nক. ${q.optA || ''}\nখ. ${q.optB || ''}\nগ. ${q.optC || ''}\nঘ. ${q.optD || ''}`.trim() };
            if (q.type === 'creative') return { ...commonFields, content: `${q.stimulus || ''}\nক. ${q.qA || ''}\nখ. ${q.qB || ''}\nগ. ${q.qC || ''}\nঘ. ${q.qD || ''}`.trim() };
            return { ...commonFields, content: (q.shortText || '').trim() };
          });
          setQuestions(reconstructed);
          sessionStorage.removeItem('merged_questions_data');
        }
        setLoading(false);
      }
    }
    if (user && db) loadQuestions();
  }, [editId, source, db, user]);

  const subjects = useMemo(() => meta.classId ? getSubjectsForClass(meta.classId) : [], [meta.classId]);

  const handleAddQuestion = (type: 'creative' | 'short' | 'mcq') => { setQuestions(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type, content: '', imageUrl: '', section: meta.currentSection }]); };

  const handleSaveToDb = () => {
    if (!user || !db) return; setSaving(true);
    const formattedQuestions = questions.map(q => {
      const parts = { main: '', k: '', kh: '', g: '', gh: '' };
      const markers = ['ক', 'খ', 'গ', 'ঘ'];
      const findMarkerPos = (m: string, fromIndex: number = 0) => { const patterns = [ m + '.', m + ')', m + ' .', m + ' )', '(' + m + ')', '(' + m + ' )', '\n' + m + '.', '\n' + m + ')', '\n' + '(' + m + ')' ]; let minIdx = -1; for (const p of patterns) { let idx = q.content.indexOf(p, fromIndex); if (idx !== -1) { if (minIdx === -1 || idx < minIdx) minIdx = idx; } } return minIdx; };
      let firstM = -1; for (const m of markers) { const pos = findMarkerPos(m); if (pos !== -1 && (firstM === -1 || pos < firstM)) firstM = pos; }
      if (firstM !== -1) { parts.main = q.content.substring(0, firstM).trim(); const extract = (m: string) => { const startIdx = findMarkerPos(m); if (startIdx === -1) return ''; let markerEnd = startIdx; while (markerEnd < q.content.length && ( q.content[markerEnd] === ' ' || q.content[markerEnd] === '\n' || q.content[markerEnd] === '(' || markers.includes(q.content[markerEnd]) || ['.', ')'].includes(q.content[markerEnd]) )) markerEnd++; let end = q.content.length; for (const otherM of markers) { if (otherM === m) continue; const e = findMarkerPos(otherM, markerEnd); if (e !== -1 && e < end) end = e; } return q.content.substring(markerEnd, end).trim(); }; parts.k = extract('ক'); parts.kh = extract('খ'); parts.g = extract('গ'); parts.gh = extract('ঘ'); } else { parts.main = q.content.trim(); }
      const common = { type: q.type, imageUrl: q.imageUrl || '', section: q.section || '' };
      if (q.type === 'creative') return { ...common, stimulus: parts.main, qA: parts.k, qB: parts.kh, qC: parts.g, qD: parts.gh };
      if (q.type === 'mcq') return { ...common, mcqQuestion: parts.main, optA: parts.k, optB: parts.kh, optC: parts.g, optD: parts.gh };
      return { ...common, shortText: q.content };
    });
    const docId = editId || doc(collection(db, 'questions')).id;
    const data: any = { ...meta, questions: formattedQuestions, userId: user.uid, updatedAt: serverTimestamp(), isMcq: questions.some(q => q.type === 'mcq') };
    if (!editId) data.createdAt = serverTimestamp();
    const ref = doc(db, 'questions', docId);
    setDoc(ref, data, { merge: true }).then(() => { setSaving(false); toast({ title: "সফল!", description: "সেভ হয়েছে।" }); if (!editId) router.replace(`/create-question?id=${docId}`); }).catch(async () => { setSaving(false); errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'write', requestResourceData: data })); });
  };

  const isEnglish = meta.subject?.toLowerCase().includes('english') || meta.subject?.toLowerCase().includes('ইংরেজি');

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32 font-kalpurush">
      <div className={cn("no-print space-y-8", isPrintMode && "hidden")}>
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm"><FileText className="w-7 h-7" /></div><h2 className="text-2xl font-bold text-primary">প্রশ্নপত্র নির্মাতা</h2></div>
          <div className="flex gap-2"><Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold"><ArrowLeft className="w-4 h-4" /> ফিরে যান</Button><Button variant="secondary" onClick={() => { const p = new URLSearchParams(window.location.search); p.set('print', 'true'); if(editId) p.set('id', editId); router.push(`${window.location.pathname}?${p.toString()}`); }} className="gap-2 font-bold"><Printer className="w-4 h-4" /> প্রিন্ট</Button></div>
        </header>
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50 p-1 h-12"><TabsTrigger value="sample" className="gap-2 font-bold h-10"><FileText className="w-4 h-4" /> নমুনা প্রশ্ন</TabsTrigger><TabsTrigger value="exam" className="gap-2 font-bold h-10"><BrainCircuit className="w-4 h-4" /> ব্যাংক থেকে প্রশ্ন</TabsTrigger></TabsList>
          <TabsContent value="sample" className="space-y-6 animate-in fade-in duration-300">
            <Card className="shadow-md">
              <CardHeader className="bg-primary/5 border-b py-3"><CardTitle className="text-base flex items-center gap-2 font-bold"><BookOpen className="w-4 h-4 text-primary" /> পরীক্ষার তথ্য ও মান বণ্টন</CardTitle></CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2"><label className="text-sm font-semibold">প্রশ্নের ধরণ</label>
                    <Select onValueChange={v => setMeta(prev => ({...prev, examType: v}))} value={meta.examType}>
                      <SelectTrigger className="font-bold"><SelectValue placeholder="ধরণ নির্বাচন" /></SelectTrigger>
                      <SelectContent><SelectItem value="creative">সৃজনশীল প্রশ্নপত্র</SelectItem><SelectItem value="mcq">বহুনির্বাচনী (MCQ)</SelectItem><SelectItem value="model_test">মডেল টেস্ট</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label><Input value={meta.institution || ''} onChange={e => setMeta(prev => ({...prev, institution: e.target.value}))} className="font-bold" /></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">পরীক্ষার নাম</label><Input value={meta.exam || ''} onChange={e => setMeta(prev => ({...prev, exam: e.target.value}))} className="font-bold" /></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">শ্রেণি</label><Select onValueChange={v => setMeta(prev => ({...prev, classId: v}))} value={meta.classId}><SelectTrigger className="font-bold"><SelectValue placeholder="শ্রেণি" /></SelectTrigger><SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">বিষয়</label><Select onValueChange={v => setMeta(prev => ({...prev, subject: v}))} value={meta.subject} disabled={!meta.classId}><SelectTrigger className="font-bold"><SelectValue placeholder="বিষয়" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">অধ্যায় (Chapter)</label><Input value={meta.chapter || ''} onChange={e => setMeta(prev => ({...prev, chapter: e.target.value}))} placeholder="যেমন: প্রথম অধ্যায়" className="font-bold" /></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">সময়</label><Input value={meta.time || ''} onChange={e => setMeta(prev => ({...prev, time: e.target.value}))} className="font-bold" /></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">পূর্ণমান</label><Input value={meta.totalMarks || ''} onChange={e => setMeta(prev => ({...prev, totalMarks: e.target.value}))} className="font-bold" /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2"><h3 className="text-lg font-bold">প্রশ্নসমূহ ({toBengaliNumber(questions.length)})</h3><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => handleAddQuestion('creative')} className="border-primary text-primary font-bold"><Plus className="w-3 h-3" /> সৃজনশীল</Button><Button variant="outline" size="sm" onClick={() => handleAddQuestion('short')} className="border-accent text-accent font-bold"><Plus className="w-3 h-3" /> সংক্ষিপ্ত</Button><Button variant="outline" size="sm" onClick={() => handleAddQuestion('mcq')} className="border-orange-500 text-orange-600 font-bold"><Plus className="w-3 h-3" /> বহুনির্বাচনি</Button></div></div>
          {questions.map((q, idx) => (
            <Card key={q.id} className={cn("relative border-l-4 animate-in slide-in-from-right-2 duration-300", q.type === 'mcq' ? 'border-l-orange-500' : q.type === 'short' ? 'border-l-accent' : 'border-l-primary')}>
              <div className="absolute top-2 right-2 no-print flex gap-1"><Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setQuestions(prev => prev.filter(item => item.id !== q.id))}><Trash2 className="w-4 h-4" /></Button></div>
              <CardContent className="pt-6 space-y-4"><div className="flex items-center gap-2 flex-wrap"><span className={`px-2 py-0.5 text-[10px] font-bold rounded ${q.type === 'mcq' ? 'bg-orange-100 text-orange-600' : q.type === 'short' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>{q.type === 'mcq' ? 'বহুনির্বাচনি' : q.type === 'short' ? 'সংক্ষিপ্ত' : 'সৃজনশীল'}</span><span className="text-sm font-bold">প্রশ্ন নং: {isEnglish ? (idx + 1) : toBengaliNumber(idx + 1)}</span></div><Textarea placeholder="উদ্দীপক ও প্রশ্ন ক. খ. গ. ঘ. সহ লিখুন..." value={q.content} onChange={e => setQuestions(prev => prev.map(item => item.id === q.id ? {...item, content: e.target.value} : item))} className="min-h-[120px] text-sm font-bold" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="flex gap-4 pt-8"><Button onClick={handleSaveToDb} disabled={saving} className="gap-2 px-8 font-bold"><Save className="w-4 h-4" /> সেভ করুন</Button><Button onClick={() => { const p = new URLSearchParams(window.location.search); p.set('print', 'true'); if(editId) p.set('id', editId); router.push(`${window.location.pathname}?${p.toString()}`); }} variant="secondary" className="gap-2 px-10 shadow-lg font-bold"><Printer className="w-4 h-4" /> প্রিন্ট</Button></div>
      </div>

      {isPrintMode && (
        <div className="print-view-container flex flex-col h-screen fixed inset-0 top-0 left-0 bg-slate-100 z-[40] font-kalpurush overflow-hidden">
          <header className="no-print h-14 bg-white border-b flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center"><Eye className="w-5 h-5" /></div>
               <h3 className="font-bold text-lg">প্রিন্ট প্রিভিউ ও লেআউট - {meta.institution || appName}</h3>
             </div>
             <div className="flex gap-3">
               <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2 font-bold border-primary text-primary bg-white"><ArrowLeft className="w-4 h-4" /> ফিরে যান</Button>
               <Button size="sm" onClick={handleSaveToDb} disabled={saving} className="gap-2 font-bold bg-green-600 hover:bg-green-700 px-4">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} সেভ</Button>
               <Button size="sm" onClick={() => window.print()} className="gap-2 font-bold bg-primary px-6"><Printer className="w-4 h-4" /> প্রিন্ট করুন</Button>
             </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-slate-200 pt-16 pb-24 flex flex-col items-center gap-10">
             <div className="paper shadow-2xl bg-white relative overflow-hidden p-[0.7in] font-kalpurush" style={{ width: '8.27in', minHeight: '11.69in' }}>
                <header className="text-center border-b-2 border-black pb-2 mb-6">
                  <h1 className="font-black text-[24pt] text-black leading-tight uppercase">{meta.institution || appName}</h1>
                  <h2 className="text-[15pt] font-bold text-black mt-2 underline">{meta.exam}</h2>
                  <div className="flex justify-between items-center text-[12pt] font-bold mt-6 px-4">
                    <span>শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || ''}</span>
                    <span>বিষয়: {meta.subject} {meta.chapter && `(${meta.chapter})`}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11pt] font-bold mt-2 px-4 italic border-t pt-1 border-dashed border-slate-300">
                    <span>সময়: {meta.time}</span>
                    <span>পূর্ণমান: {toBengaliNumber(meta.totalMarks)}</span>
                  </div>
                </header>
                
                <div className="space-y-8 text-black text-[11pt]">
                   {questions.length > 0 ? (
                     questions.map((q, idx) => (
                       <div key={q.id} className="space-y-3">
                         <div className="flex gap-2 font-bold">
                           <span className="shrink-0">{isEnglish ? (idx + 1) : toBengaliNumber(idx + 1)}.</span>
                           <div 
                             className="flex-1 whitespace-pre-wrap leading-relaxed text-justify"
                             dangerouslySetInnerHTML={{ __html: formatMath(q.content) }}
                           />
                         </div>
                       </div>
                     ))
                   ) : (
                     <div className="text-center py-20 text-slate-400">কোনো প্রশ্ন পাওয়া যায়নি।</div>
                   )}
                </div>
                
                <footer className="mt-auto pt-10 flex justify-between text-[8pt] font-bold text-slate-400">
                  <span>মুদ্রিত তারিখ: {format(new Date(), 'dd/MM/yyyy')}</span>
                  <span>{appName} - ডিজিটাল প্রশ্ন ব্যাংক</span>
                </footer>
             </div>
          </main>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.85em; margin: 0 2px; }
          .math-num { border-bottom: 0.5pt solid black; padding: 0 1px; }
          .math-den { padding: 0 1px; }
          .math-sqrt { display: inline-flex; align-items: center; }
          .math-sqrt-stem { border-top: 0.5pt solid black; padding-top: 1px; }
          .math-sup { font-size: 0.7em; vertical-align: super; }
          .math-sub { font-size: 0.7em; vertical-align: sub; }
          .paper { color: black !important; }
        }
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; height: auto !important; width: 100% !important; }
          .no-print { display: none !important; }
          .print-view-container { position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; padding: 0 !important; background: white !important; width: 100% !important; }
          .paper { width: 8.27in !important; min-height: 11.69in !important; margin: 0 !important; padding: 0.7in !important; box-shadow: none !important; }
          @page { size: A4; margin: 0 !important; }
        }
      `}} />
    </div>
  );
}

export default function CreateQuestionPage() { return <Suspense fallback={<div className="flex justify-center p-20 font-kalpurush"><Loader2 className="animate-spin text-primary" /></div>}><CreateQuestionContent /></Suspense>; }
