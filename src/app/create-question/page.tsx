
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
  Filter,
  Layers
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import Tesseract from 'tesseract.js';
import { Checkbox } from '@/components/ui/checkbox';

type Question = {
  id: string;
  type: 'creative' | 'short' | 'mcq';
  content: string;
  imageUrl?: string;
  isFromBank?: boolean;
};

async function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function formatMath(text: string) {
  if (!text) return '';
  let formatted = text.replace(/\(\((.*?)\)\)/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
  
  // Text processing
  formatted = formatted.replace(/\\text\{([^}]+)\}/g, '<span class="math-text">$1</span>');

  // Fractions with recursive support for nesting
  const fracRegex = /\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  formatted = formatted.replace(fracRegex, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');

  // Square Roots
  formatted = formatted.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '<span class="math-sqrt"><sup class="math-root">$1</sup>√<span class="math-sqrt-stem">$2</span></span>');
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-sqrt-stem">$1</span></span>');

  // Subscripts / Superscripts
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/\^(\d+|[a-z]|[A-Z])/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/_(\d+|[a-z]|[A-Z])/g, '<sub class="math-sub">$1</sub>');

  // Common Symbols
  const symbolMap: Record<string, string> = {
    '\\\\log': 'log', '\\\\triangle': '△', '\\\\angle': '∠', '\\\\circ': '°',
    '\\\\theta': 'θ', '\\\\pi': 'π', '\\\\pm': '±', '\\\\times': '×',
    '\\\\neq': '≠', '\\\\ne': '≠', '\\\\leq': '≤', '\\\\geq': '≥',
    '\\\\degree': '°', '\\\\cdot': '·', '\\\\infty': '∞', '\\\\approx': '≈',
    '\\\\sum': '∑', '\\\\prod': '∏', '\\\\alpha': 'α', '\\\\beta': 'β',
    '\\\\gamma': 'γ', '\\\\delta': 'δ', '\\\\sigma': 'σ', '\\\\phi': 'φ', '\\\\omega': 'ω',
    '\\\\eta': 'η', '\\\\rho': 'ρ', '\\\\lambda': 'λ', '\\\\mu': 'μ',
    '\\\\in': '∈', '\\\\mathbb\\{N\\}': 'ℕ', '\\\\mathbb\\{R\\}': 'ℝ', '\\\\mathbb\\{Z\\}': 'ℤ',
    '\\\\mathbb\\{Q\\}': 'ℚ', '\\\\subset': '⊂', '\\\\subseteq': '⊆', '\\\\cup': '∪',
    '\\\\cap': '∩', '\\\\emptyset': '∅', '\\\\forall': '∀', '\\\\exists': '∃', 
    '\\\\rightarrow': '→', '\\\\Rightarrow': '⇒', '\\\\leftarrow': '←', '\\\\Leftarrow': '⇐', 
    '\\\\leftrightarrow': '↔', '\\\\Leftrightarrow': '⇔', '\\\\to': '→', '\\\\arrow': '→',
    '\\\\left': '', '\\\\right': '', '\\\\\%': '%', '\\\\setminus': '\\', '\\\\backslash': '\\'
  };
  
  Object.entries(symbolMap).forEach(([key, val]) => { 
    formatted = formatted.replace(new RegExp(key, 'g'), val); 
  });

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
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'sample' | 'exam'>('sample');
  
  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';
  
  const [meta, setMeta] = useState({
    institution: 'টপ গ্রেড টিউটোরিয়ালস', 
    exam: 'সাপ্তাহিক পরীক্ষা', 
    chapter: '', 
    classId: '', 
    subject: '', 
    time: '২ ঘণ্টা ৩০ মিনিট', 
    totalMarks: '১০০',
    creativeInstruction: 'যেকোনো ৭টি প্রশ্নের উত্তর দাও', 
    shortInstruction: 'সকল প্রশ্নের উত্তর দাও',
    mcqInstruction: 'সঠিক উত্তরের বিপরীতের বৃত্তটি বল পয়েন্ট কলম দ্বারা ভরাট কর। সকল প্রশ্নের উত্তর দিতে হবে। প্রশ্নপত্রে কোন প্রকার দাগ দেওয়া যাবে না।', 
    marksA: 1, marksB: 2, marksC: 3, marksD: 4, shortMarks: 2, mcqMarks: 1
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // Exam Questions (Bank) States
  const [selectedBankSubject, setSelectedBankSubject] = useState('');
  const [selectedBankClass, setSelectedBankClass] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  const bankQuery = useMemo(() => {
    if (!db || !user || !selectedBankClass || !selectedBankSubject) return null;
    return query(
      collection(db, 'questions'), 
      where('userId', '==', user.uid),
      where('classId', '==', selectedBankClass),
      where('subject', '==', selectedBankSubject)
    );
  }, [db, user, selectedBankClass, selectedBankSubject]);

  const { data: bankResults, loading: bankLoading } = useCollection(bankQuery);

  const availableChapters = useMemo(() => {
    if (!bankResults) return [];
    const chapters = Array.from(new Set(bankResults.map(r => r.chapter).filter(Boolean)));
    return chapters as string[];
  }, [bankResults]);

  const questionsFromSelectedChapters = useMemo(() => {
    if (!bankResults || selectedChapters.length === 0) return [];
    const list: any[] = [];
    bankResults.forEach(res => {
      if (selectedChapters.includes(res.chapter)) {
        if (res.questions) {
          res.questions.forEach((q: any) => {
            list.push({ ...q, parentDocId: res.id, chapter: res.chapter });
          });
        }
      }
    });
    return list;
  }, [bankResults, selectedChapters]);

  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState<string[]>([]);

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
            if (data.userId !== user.uid) { router.push('/my-questions'); return; }
            setMeta(prev => ({
              ...prev,
              institution: data.institution || 'টপ গ্রেড টিউটোরিয়ালস', 
              exam: data.exam || '', 
              chapter: data.chapter || '', 
              classId: data.classId || '',
              subject: data.subject || '', 
              time: data.time || '', 
              totalMarks: data.totalMarks || '',
              creativeInstruction: data.creativeInstruction || 'যেকোনো ৭টি প্রশ্নের উত্তর দাও', 
              shortInstruction: data.shortInstruction || 'সকল প্রশ্নের উত্তর দাও',
              mcqInstruction: data.mcqInstruction || 'সঠিক উত্তরের বিপরীতের বৃত্তটি বল পয়েন্ট কলম দ্বারা ভরাট কর। সকল প্রশ্নের উত্তর দিতে হবে। প্রশ্নপত্রে কোন প্রকার দাগ দেওয়া যাবে না।',
              marksA: data.marksA || 1, marksB: data.marksB || 2, marksC: data.marksC || 3, marksD: data.marksD || 4,
              shortMarks: data.shortMarks || 2, mcqMarks: data.mcqMarks || 1
            }));
            const reconstructed = (data.questions || []).map((q: any) => {
              const id = Math.random().toString(36).substr(2, 9);
              const commonFields = { id, type: q.type, imageUrl: q.imageUrl || '' };
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
            const commonFields = { id, type: q.type, imageUrl: q.imageUrl || '' };
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
  }, [editId, source, db, user, router]);

  useEffect(() => {
    if (isPrintMode && !loading && !userLoading && questions.length > 0) {
      const timer = setTimeout(() => { window.print(); }, 800);
      return () => clearTimeout(timer);
    }
  }, [isPrintMode, loading, userLoading, questions]);

  const subjects = useMemo(() => meta.classId ? getSubjectsForClass(meta.classId) : [], [meta.classId]);
  const bankSubjects = useMemo(() => selectedBankClass ? getSubjectsForClass(selectedBankClass) : [], [selectedBankClass]);

  const handleAddQuestion = (type: 'creative' | 'short' | 'mcq') => {
    setQuestions(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type, content: '', imageUrl: '' }]);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeQuestionId) return;
    try {
      const base64 = await processImage(file);
      setQuestions(prev => prev.map(q => q.id === activeQuestionId ? { ...q, imageUrl: base64 } : q));
      toast({ title: "সফল", description: "ছবি যুক্ত করা হয়েছে।" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: error.message });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setActiveQuestionId(null);
    }
  };

  const handleOCR = async (Eisen: React.ChangeEvent<HTMLInputElement>, questionId: string) => {
    const file = Eisen.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    toast({ title: "স্ক্যান শুরু হয়েছে", description: "লোকাল স্ক্যানার ইমেজ প্রসেস করছে..." });
    try {
      const result = await Tesseract.recognize(file, 'ben+eng');
      if (result && result.data.text) {
        const text = result.data.text.trim();
        setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, content: q.content ? q.content + '\n' + text : text } : q));
        toast({ title: "সফল!", description: "টেক্সট এক্সট্রাক্ট করা হয়েছে।" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "স্ক্যান ব্যর্থ হয়েছে", description: "আবার চেষ্টা করুন।" });
    } finally {
      setIsScanning(false);
      if (ocrInputRef.current) ocrInputRef.current.value = '';
    }
  };

  const parseText = (text: string) => {
    const parts = { main: '', k: '', kh: '', g: '', gh: '' };
    if (!text) return parts;
    const cleanText = text.trim();
    const markers = ['ক', 'খ', 'গ', 'ঘ'];
    const findMarkerPos = (m: string, fromIndex: number = 0) => {
      const patterns = [ m + '.', m + ')', m + ' .', m + ' )', '(' + m + ')', '(' + m + ' )' ];
      let minIdx = -1;
      for (const p of patterns) {
        let idx = cleanText.indexOf(p, fromIndex);
        if (idx !== -1) { if (minIdx === -1 || idx < minIdx) minIdx = idx; }
      }
      return minIdx;
    };
    let firstMarkerPos = -1;
    for (const m of markers) {
      const pos = findMarkerPos(m);
      if (pos !== -1 && (firstMarkerPos === -1 || pos < firstMarkerPos)) firstMarkerPos = pos;
    }
    if (firstMarkerPos !== -1) {
      parts.main = cleanText.substring(0, firstMarkerPos).trim();
      const extract = (m: string) => {
        const startIdx = findMarkerPos(m);
        if (startIdx === -1) return '';
        let markerEnd = startIdx;
        while (markerEnd < cleanText.length && (cleanText[markerEnd] === ' ' || cleanText[markerEnd] === '\n' || cleanText[markerEnd] === '(' || markers.includes(cleanText[markerEnd]) || ['.', ')'].includes(cleanText[markerEnd]))) markerEnd++;
        let end = cleanText.length;
        for (const otherM of markers) { if (otherM === m) continue; const e = findMarkerPos(otherM, markerEnd); if (e !== -1 && e < end) end = e; }
        return cleanText.substring(markerEnd, end).trim();
      };
      parts.k = extract('ক'); parts.kh = extract('খ'); parts.g = extract('গ'); parts.gh = extract('ঘ');
    } else { parts.main = cleanText.trim(); }
    return parts;
  };

  const handleSaveToDb = () => {
    if (!user || !db) { toast({ title: "লগইন প্রয়োজন", variant: "destructive" }); return; }
    setSaving(true);
    const formattedQuestions = questions.map(q => {
      const p = parseText(q.content || '');
      const common = { type: q.type, imageUrl: q.imageUrl || '' };
      if (q.type === 'creative') return { ...common, stimulus: p.main || '', qA: p.k || '', qB: p.kh || '', qC: p.g || '', qD: p.gh || '' };
      if (q.type === 'mcq') return { ...common, mcqQuestion: p.main || '', optA: p.k || '', optB: p.kh || '', optC: p.g || '', optD: p.gh || '' };
      return { ...common, shortText: q.content || '' };
    });
    const docId = editId || doc(collection(db, 'questions')).id;
    const data: any = {
      ...meta, 
      questions: formattedQuestions, 
      userId: user.uid, 
      updatedAt: serverTimestamp(), 
      isMcq: questions.some(q => q.type === 'mcq')
    };
    if (!editId) data.createdAt = serverTimestamp();
    const ref = doc(db, 'questions', docId);
    setDoc(ref, data, { merge: true })
      .then(() => { setSaving(false); toast({ title: "সফল!", description: "সেভ হয়েছে।" }); if (!editId) router.replace(`/create-question?id=${docId}`); })
      .catch(async () => { setSaving(false); errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'write', requestResourceData: data })); });
  };

  const handleAddFromBank = () => {
    const selected = questionsFromSelectedChapters.filter((_, idx) => selectedBankQuestionIds.includes(idx.toString()));
    const newQs = selected.map(q => {
      const id = Math.random().toString(36).substr(2, 9);
      const commonFields = { id, type: q.type, imageUrl: q.imageUrl || '', isFromBank: true };
      let content = '';
      if (q.type === 'mcq') content = `${q.mcqQuestion || ''}\nক. ${q.optA || ''}\nখ. ${q.optB || ''}\nগ. ${q.optC || ''}\nঘ. ${q.optD || ''}`;
      else if (q.type === 'creative') content = `${q.stimulus || ''}\nক. ${q.qA || ''}\nখ. ${q.qB || ''}\nগ. ${q.qC || ''}\nঘ. ${q.qD || ''}`;
      else content = q.shortText || '';
      return { ...commonFields, content: content.trim() };
    });
    setQuestions(prev => [...prev, ...newQs]);
    setIsBankDialogOpen(false);
    setSelectedBankQuestionIds([]);
    toast({ title: "সফল", description: `${toBengaliNumber(newQs.length)} টি প্রশ্ন যুক্ত করা হয়েছে।` });
  };

  const isEnglish = meta.subject?.toLowerCase().includes('english') || meta.subject?.toLowerCase().includes('ইংরেজি');
  if (loading || userLoading) return <div className="flex flex-col items-center justify-center p-20 min-h-[50vh] font-kalpurush"><Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /><p className="text-muted-foreground font-bold">লোড হচ্ছে...</p></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32 font-kalpurush">
      <div className={cn("no-print space-y-8", isPrintMode && "hidden")}>
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm"><FileText className="w-7 h-7" /></div>
            <h2 className="text-2xl font-bold text-primary">প্রশ্নপত্র নির্মাতা</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/my-questions')} className="gap-2 font-bold"><ArrowLeft className="w-4 h-4" /> লাইব্রেরি</Button>
            <Button variant="secondary" onClick={() => window.print()} className="gap-2 font-bold"><Printer className="w-4 h-4" /> প্রিন্ট</Button>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50 p-1">
            <TabsTrigger value="sample" className="gap-2 font-bold">
              <FileText className="w-4 h-4" /> নমুনা প্রশ্ন (ম্যানুয়াল)
            </TabsTrigger>
            <TabsTrigger value="exam" className="gap-2 font-bold">
              <BrainCircuit className="w-4 h-4" /> পরীক্ষার প্রশ্ন (ব্যাংক থেকে)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sample" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="shadow-md">
              <CardHeader className="bg-primary/5 border-b py-3"><CardTitle className="text-base flex items-center gap-2 font-bold"><BookOpen className="w-4 h-4 text-primary" /> পরীক্ষার তথ্য ও মান বণ্টন</CardTitle></CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2"><label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label><Input value={meta.institution || ''} onChange={e => setMeta(prev => ({...prev, institution: e.target.value}))} className="font-bold" /></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">পরীক্ষার নাম</label><Input value={meta.exam || ''} onChange={e => setMeta(prev => ({...prev, exam: e.target.value}))} className="font-bold" /></div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">অধ্যায় (Chapter)</label>
                    <Input value={meta.chapter || ''} onChange={e => setMeta(prev => ({...prev, chapter: e.target.value}))} placeholder="যেমন: প্রথম অধ্যায়" className="font-bold" />
                  </div>
                  <div className="space-y-2"><label className="text-sm font-semibold">সময়</label><Input value={meta.time || ''} onChange={e => setMeta(prev => ({...prev, time: e.target.value}))} className="font-bold" /></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">পূর্ণমান</label><Input value={meta.totalMarks || ''} onChange={e => setMeta(prev => ({...prev, totalMarks: e.target.value}))} className="font-bold" /></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">শ্রেণি</label><Select onValueChange={v => setMeta(prev => ({...prev, classId: v}))} value={meta.classId}><SelectTrigger className="font-bold"><SelectValue placeholder="শ্রেণি" /></SelectTrigger><SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-sm font-semibold">বিষয়</label><Select onValueChange={v => setMeta(prev => ({...prev, subject: v}))} value={meta.subject} disabled={!meta.classId}><SelectTrigger className="font-bold"><SelectValue placeholder="বিষয়" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-xs font-semibold">সৃজনশীল নির্দেশিকা</label><Input value={meta.creativeInstruction} onChange={e => setMeta(p => ({...p, creativeInstruction: e.target.value}))} className="font-bold h-8" /></div>
                  <div className="space-y-2"><label className="text-xs font-semibold">সংক্ষিপ্ত প্রশ্ন নির্দেশিকা</label><Input value={meta.shortInstruction} onChange={e => setMeta(p => ({...p, shortInstruction: e.target.value}))} className="font-bold h-8" /></div>
                  <div className="space-y-2 col-span-full"><label className="text-xs font-semibold">এমসিকিউ নির্দেশিকা</label><Input value={meta.mcqInstruction} onChange={e => setMeta(p => ({...p, mcqInstruction: e.target.value}))} className="font-bold h-8" /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exam" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="shadow-md border-primary/20">
              <CardHeader className="bg-primary/5 border-b py-3">
                <CardTitle className="text-base flex items-center gap-2 font-bold text-primary">
                  <BrainCircuit className="w-4 h-4" /> ব্যাংক থেকে প্রশ্ন বাছাই করুন
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">শ্রেণি নির্বাচন করুন</label>
                    <Select onValueChange={setSelectedBankClass} value={selectedBankClass}>
                      <SelectTrigger className="font-bold"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                      <SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">বিষয় নির্বাচন করুন</label>
                    <Select onValueChange={setSelectedBankSubject} value={selectedBankSubject} disabled={!selectedBankClass}>
                      <SelectTrigger className="font-bold"><SelectValue placeholder="বিষয়" /></SelectTrigger>
                      <SelectContent>{bankSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedBankSubject && (
                  <div className="space-y-4 pt-4 border-t animate-in fade-in duration-500">
                    <label className="text-sm font-black text-primary flex items-center gap-2">
                      <Layers className="w-4 h-4" /> সংরক্ষিত অধ্যায়সমূহ (নমুনা প্রশ্ন হতে সংগৃহীত)
                    </label>
                    {bankLoading ? (
                      <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : availableChapters.length === 0 ? (
                      <div className="p-10 text-center bg-muted/20 rounded-xl border-2 border-dashed">
                        <p className="text-muted-foreground font-bold">এই বিষয়ের কোনো নমুনা প্রশ্ন পাওয়া যায়নি।</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {availableChapters.map(ch => (
                          <div 
                            key={ch} 
                            onClick={() => setSelectedChapters(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])}
                            className={cn(
                              "p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-between font-bold text-xs",
                              selectedChapters.includes(ch) ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"
                            )}
                          >
                            <span className="truncate pr-2">{ch}</span>
                            {selectedChapters.includes(ch) && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedChapters.length > 0 && (
                      <div className="flex justify-center pt-4">
                        <Button onClick={() => setIsBankDialogOpen(true)} className="gap-2 font-bold bg-primary shadow-lg shadow-primary/20">
                          <BrainCircuit className="w-4 h-4" /> প্রশ্ন বাছাই করুন ({toBengaliNumber(selectedChapters.length)} অধ্যায়)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Question Editor Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-bold">প্রশ্নসমূহ ({toBengaliNumber(questions.length)})</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('creative')} className="border-primary text-primary font-bold"><Plus className="w-3 h-3" /> সৃজনশীল</Button>
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('short')} className="border-accent text-accent font-bold"><Plus className="w-3 h-3" /> সংক্ষিপ্ত</Button>
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('mcq')} className="border-orange-500 text-orange-600 font-bold"><Plus className="w-3 h-3" /> বহুনির্বাচনি</Button>
            </div>
          </div>

          {questions.map((q, idx) => (
            <Card key={q.id} className={cn(
              "relative border-l-4 animate-in slide-in-from-right-2 duration-300",
              q.type === 'mcq' ? 'border-l-orange-500' : q.type === 'short' ? 'border-l-accent' : 'border-l-primary',
              q.isFromBank && "bg-slate-50/50"
            )}>
              <div className="absolute top-2 right-2 no-print flex gap-1">
                <input type="file" ref={ocrInputRef} className="hidden" accept="image/*" onChange={(e) => handleOCR(e, q.id)} />
                <Button variant="ghost" size="icon" className="text-indigo-600 h-8 w-8" onClick={() => ocrInputRef.current?.click()} disabled={isScanning} title="স্ক্যান"><ScanText className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-primary h-8 w-8" onClick={() => { setActiveQuestionId(q.id); fileInputRef.current?.click(); }} title="ছবি"><ImageIcon className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setQuestions(prev => prev.filter(item => item.id !== q.id))}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${q.type === 'mcq' ? 'bg-orange-100 text-orange-600' : q.type === 'short' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>{q.type === 'mcq' ? 'বহুনির্বাচনি' : q.type === 'short' ? 'সংক্ষিপ্ত' : 'সৃজনশীল'}</span>
                  <span className="text-sm font-bold">প্রশ্ন নং: {isEnglish ? (idx + 1) : toBengaliNumber(idx + 1)}</span>
                </div>
                <Textarea placeholder="উদ্দীপক ও প্রশ্ন ক. খ. গ. ঘ. সহ লিখুন..." value={q.content} onChange={e => setQuestions(prev => prev.map(item => item.id === q.id ? {...item, content: e.target.value} : item))} className="min-h-[120px] text-sm font-bold leading-[1.1]" style={{ lineHeight: '1.1' }} />
                {q.imageUrl && <div className="relative w-40 rounded border overflow-hidden"><img src={q.imageUrl} className="w-full h-auto" /><button onClick={() => setQuestions(prev => prev.map(item => item.id === q.id ? {...item, imageUrl: ''} : item))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5"><X className="w-3 h-3" /></button></div>}
              </CardContent>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </Card>
          ))}
        </div>

        <div className="flex gap-4 pt-8">
          <Button onClick={handleSaveToDb} disabled={saving} className="gap-2 px-8 font-bold"><Save className="w-4 h-4" /> সেভ করুন</Button>
          <Button onClick={() => window.print()} variant="secondary" className="gap-2 px-10 shadow-lg font-bold"><Printer className="w-4 h-4" /> প্রিন্ট</Button>
        </div>
      </div>

      {/* Bank Question Selection Popup */}
      <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col font-kalpurush">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
              <BrainCircuit className="w-6 h-6" /> প্রশ্নপত্র ব্যাংক
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="প্রশ্ন খুঁজুন..." 
                value={bankSearch} 
                onChange={e => setBankSearch(e.target.value)} 
                className="pl-9 font-bold"
              />
            </div>

            <div className="space-y-4">
              {questionsFromSelectedChapters.filter(q => {
                const search = bankSearch.toLowerCase();
                return (q.mcqQuestion || q.stimulus || q.shortText || '').toLowerCase().includes(search);
              }).map((q, idx) => {
                const isSelected = selectedBankQuestionIds.includes(idx.toString());
                const previewText = q.type === 'mcq' ? q.mcqQuestion : q.type === 'creative' ? q.stimulus : q.shortText;
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedBankQuestionIds(prev => prev.includes(idx.toString()) ? prev.filter(id => id !== idx.toString()) : [...prev, idx.toString()])}
                    className={cn(
                      "p-4 border-2 rounded-xl cursor-pointer transition-all flex gap-4",
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                    )}
                  >
                    <div className="pt-1">
                      <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                    </div>
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase ${q.type === 'mcq' ? 'bg-orange-100 text-orange-600' : q.type === 'short' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                          {q.type === 'mcq' ? 'এমসিকিউ' : q.type === 'short' ? 'সংক্ষিপ্ত' : 'সৃজনশীল'}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground">{q.chapter}</span>
                      </div>
                      <p className="text-sm font-bold line-clamp-3 leading-[1.1]" style={{ lineHeight: '1.1' }}>{previewText}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsBankDialogOpen(false)} className="font-bold">বাতিল</Button>
            <Button onClick={handleAddFromBank} disabled={selectedBankQuestionIds.length === 0} className="gap-2 font-bold bg-primary">
              <Plus className="w-4 h-4" /> বাছাইকৃত প্রশ্ন যুক্ত করুন ({toBengaliNumber(selectedBankQuestionIds.length)})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={cn("print-only font-kalpurush", isPrintMode && "block")}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print, screen {
            .paper { line-height: 1.1; width: 100% !important; text-align: justify; color: black !important; position: relative; }
            .header { text-align: center; margin-bottom: 2px; }
            .inst-name { font-size: 23px !important; font-weight: 800; line-height: 1.1; }
            .meta-info { display: flex; justify-content: space-between; font-weight: bold; font-size: 10pt; border-top: 1.5pt solid black; padding-top: 2px; }
            .section-label { font-size: 11pt; font-weight: bold; border: 1pt solid black; display: inline-block; padding: 2px 20px; margin: 4px auto; }
            .content-area { font-size: 10.5pt; color: black !important; line-height: 1.1; }
            .mcq-container { column-count: 2; column-gap: 40px; column-rule: 1pt solid #000; }
            .mcq-options { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 10px; padding-left: 20px; font-size: 10pt; }
            .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.85em; margin: 0 2px; }
            .math-num { border-bottom: 0.5pt solid black; padding: 0 1px; }
            .math-den { padding: 0 1px; }
            .math-sqrt { display: inline-flex; align-items: center; }
            .math-sqrt-stem { border-top: 0.5pt solid black; padding-top: 1px; }
            .math-text { font-family: 'Kalpurush', sans-serif; font-style: normal; }
          }
          @media print { 
            .paper { margin: 0 !important; } 
            @page { size: auto; margin: 0.5in !important; } 
          }
        `}} />
        <div className="paper">
          <div className="header">
            <div className="inst-name">{meta.institution || appName}</div>
            <div className="font-bold text-lg">{meta.exam} {meta.chapter ? `(${meta.chapter})` : ''}</div>
            <div className="font-bold text-sm">শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label} | বিষয়: {meta.subject}</div>
            <div className="meta-info"><div>সময়: {meta.time}</div><div>পূর্ণমান: {meta.totalMarks}</div></div>
          </div>
          <div className="content-area mt-2">
            {questions.some(q => q.type === 'creative') && (
              <div className="mb-2">
                <div className="text-center mb-1"><div className="section-label">সৃজনশীল প্রশ্ন</div><p className="text-[10px] font-bold">[{meta.creativeInstruction}]</p></div>
                {questions.filter(q => q.type === 'creative').map((q, idx) => {
                  const p = parseText(q.content);
                  return (
                    <div key={q.id} className="mb-1 break-inside-avoid" style={{ lineHeight: '1.1' }}>
                      <div className="flex gap-2 font-bold"><span>{toBengaliNumber(idx + 1)}.</span><div dangerouslySetInnerHTML={{ __html: formatMath(p.main) }} /></div>
                      {q.imageUrl && <img src={q.imageUrl} className="max-w-[200px] mx-auto my-1 border" />}
                      <div className="ml-5">
                        {p.k && <div className="flex gap-2"><span>ক.</span><div className="flex-1" dangerouslySetInnerHTML={{ __html: formatMath(p.k) }} /><span>{toBengaliNumber(meta.marksA)}</span></div>}
                        {p.kh && <div className="flex gap-2"><span>খ.</span><div className="flex-1" dangerouslySetInnerHTML={{ __html: formatMath(p.kh) }} /><span>{toBengaliNumber(meta.marksB)}</span></div>}
                        {p.g && <div className="flex gap-2"><span>গ.</span><div className="flex-1" dangerouslySetInnerHTML={{ __html: formatMath(p.g) }} /><span>{toBengaliNumber(meta.marksC)}</span></div>}
                        {p.gh && <div className="flex gap-2"><span>ঘ.</span><div className="flex-1" dangerouslySetInnerHTML={{ __html: formatMath(p.gh) }} /><span>{toBengaliNumber(meta.marksD)}</span></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {questions.some(q => q.type === 'short') && (
              <div className="mb-2">
                <div className="text-center mb-1"><div className="section-label">সংক্ষিপ্ত প্রশ্ন</div><p className="text-[10px] font-bold">[{meta.shortInstruction}]</p></div>
                {questions.filter(q => q.type === 'short').map((q, idx) => (
                  <div key={q.id} className="mb-1 flex gap-2" style={{ lineHeight: '1.1' }}><span className="font-bold">{toBengaliNumber(idx + 1)}.</span><div className="flex-1" dangerouslySetInnerHTML={{ __html: formatMath(q.content) }} /><span>{toBengaliNumber(meta.shortMarks)}</span></div>
                ))}
              </div>
            )}
            {questions.some(q => q.type === 'mcq') && (
              <div className="mt-1">
                <div className="text-center mb-1"><div className="section-label">বহুনির্বাচনি প্রশ্ন</div><p className="text-[10px] font-bold">[{meta.mcqInstruction}]</p></div>
                <div className="mcq-container">
                  {questions.filter(q => q.type === 'mcq').map((q, idx) => {
                    const p = parseText(q.content);
                    return (
                      <div key={q.id} className="mcq-item mb-2 break-inside-avoid" style={{ lineHeight: '1.1' }}>
                        <div className="flex gap-2 font-bold"><span>{toBengaliNumber(idx + 1)}.</span><div dangerouslySetInnerHTML={{ __html: formatMath(p.main) }} /></div>
                        <div className="mcq-options">
                          <div>ক) <span dangerouslySetInnerHTML={{ __html: formatMath(p.k) }} /></div>
                          <div>খ) <span dangerouslySetInnerHTML={{ __html: formatMath(p.kh) }} /></div>
                          <div>গ) <span dangerouslySetInnerHTML={{ __html: formatMath(p.g) }} /></div>
                          <div>ঘ) <span dangerouslySetInnerHTML={{ __html: formatMath(p.gh) }} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateQuestionPage() { return <Suspense fallback={<div className="flex justify-center p-20 font-kalpurush"><Loader2 className="animate-spin text-primary" /></div>}><CreateQuestionContent /></Suspense>; }
