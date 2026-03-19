
"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Plus, Trash2, BookOpen, Save, FileText, ArrowLeft, Loader2, Image as ImageIcon, X, ListOrdered } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type Question = {
  id: string;
  type: 'creative' | 'short' | 'mcq';
  content: string;
  imageUrl?: string;
};

async function processImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('ফাইল সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না।');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxSide = 512;

        if (width > height) {
          if (width > maxSide) {
            height *= maxSide / width;
            width = maxSide;
          }
        } else {
          if (height > maxSide) {
            width *= maxSide / height;
            height = maxSide;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('ছবি লোড করা সম্ভব হয়নি।'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('ফাইল পড়া সম্ভব হয়নি।'));
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
    '\\\\left': '', '\\\\right': '', '\\\\\%': '%', '\\\\setminus': '\\', '\\\\backslash': '\\'
  };
  
  Object.entries(symbolMap).forEach(([key, val]) => { 
    formatted = formatted.replace(new RegExp(key, 'g'), val); 
  });
  
  let prev;
  const fracRegex = /\\frac\{([^{}]+)\}\s*\{([^{}]+)\}/g;
  do {
    prev = formatted;
    formatted = formatted.replace(fracRegex, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
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

function CreateQuestionContent() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('id');
  const mergeIds = searchParams.get('mergeIds')?.split(',') || [];
  
  const [loading, setLoading] = useState(!!editId || mergeIds.length > 0);
  const [saving, setSaving] = useState(false);
  
  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appLogoUrl = softwareConfig?.appLogoUrl || '';
  
  const [meta, setMeta] = useState({
    institution: 'টপ গ্রেড টিউটোরিয়ালস', exam: '', chapter: '', classId: '', subject: '', time: '২ ঘণ্টা ৩০ মিনিট', totalMarks: '১০০',
    creativeInstruction: 'যেকোনো ৭টি প্রশ্নের উত্তর দাও', shortInstruction: 'সকল প্রশ্নের উত্তর দাও',
    mcqInstruction: 'সঠিক উত্তরের বৃত্তটি ভরাট করো', marksA: 1, marksB: 2, marksC: 3, marksD: 4, shortMarks: 2, mcqMarks: 1
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

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
              institution: data.institution || 'টপ গ্রেড টিউটোরিয়ালস', exam: data.exam || '', chapter: data.chapter || '', classId: data.classId || '',
              subject: data.subject || '', time: data.time || '', totalMarks: data.totalMarks || '',
              creativeInstruction: data.creativeInstruction || '', 
              shortInstruction: data.shortInstruction || 'সকল প্রশ্নের উত্তর দাও',
              mcqInstruction: data.mcqInstruction || 'সঠিক উত্তরের বৃত্তটি ভরাট করো',
              marksA: data.marksA || 1, marksB: data.marksB || 2, marksC: data.marksC || 3, marksD: data.marksD || 4,
              shortMarks: data.shortMarks || 2, mcqMarks: data.mcqMarks || 1
            }));
            const reconstructed = (data.questions || []).map((q: any) => {
              const id = Math.random().toString(36).substr(2, 9);
              const commonFields = { id, type: q.type, imageUrl: q.imageUrl || '' };
              if (q.type === 'mcq') return { ...commonFields, content: `${q.mcqQuestion || ''}\nক. ${q.optA || ''}\nখ. ${q.optB || ''}\nগ. ${q.optC || ''}\nঘ. ${q.optD || ''}` };
              if (q.type === 'creative') return { ...commonFields, content: `${q.stimulus || ''}\nক. ${q.qA || ''}\nখ. ${q.qB || ''}\nগ. ${q.qC || ''}\nঘ. ${q.qD || ''}` };
              return { ...commonFields, content: q.shortText || '' };
            });
            setQuestions(reconstructed);
          }
        } catch (e) {} finally { setLoading(false); }
      } else if (mergeIds.length > 0) {
        try {
          let mergedQuestions: Question[] = [];
          let firstSet: any = null;

          for (const id of mergeIds) {
            const docSnap = await getDoc(doc(db, 'questions', id));
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (!firstSet) firstSet = data;
              
              const reconstructed = (data.questions || []).map((q: any) => {
                const qId = Math.random().toString(36).substr(2, 9);
                const commonFields = { id: qId, type: q.type, imageUrl: q.imageUrl || '' };
                if (q.type === 'mcq') return { ...commonFields, content: `${q.mcqQuestion || ''}\nক. ${q.optA || ''}\nখ. ${q.optB || ''}\nগ. ${q.optC || ''}\nঘ. ${q.optD || ''}` };
                if (q.type === 'creative') return { ...commonFields, content: `${q.stimulus || ''}\nক. ${q.qA || ''}\nখ. ${q.qB || ''}\nগ. ${q.qC || ''}\nঘ. ${q.qD || ''}` };
                return { ...commonFields, content: q.shortText || '' };
              });
              mergedQuestions = [...mergedQuestions, ...reconstructed];
            }
          }

          if (firstSet) {
            setMeta(prev => ({
              ...prev,
              classId: firstSet.classId,
              subject: firstSet.subject,
              institution: firstSet.institution
            }));
          }
          setQuestions(mergedQuestions);
        } catch (e) {} finally { setLoading(false); }
      }
    }
    if (user && db) loadQuestions();
  }, [editId, mergeIds.join(','), db, user, router]);

  const subjects = useMemo(() => meta.classId ? getSubjectsForClass(meta.classId) : [], [meta.classId]);
  const chapters = useMemo(() => (meta.classId && meta.subject) ? getChaptersForSubject(meta.classId, meta.subject) : [], [meta.classId, meta.subject]);

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

  const parseText = (text: string) => {
    const parts = { main: '', k: '', kh: '', g: '', gh: '' };
    if (!text) return parts;
    const cleanText = text.replace(/\(\((.*?)\)\)/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
    const markers = ['ক', 'খ', 'গ', 'ঘ'];
    let firstMarkerPos = -1;
    const findMarkerPos = (m: string, fromIndex: number = 0) => {
      const patterns = [ m + '.', m + ')', m + ' .', m + ' )', m + '.\n', m + ')\n', '\n' + m + '.', '\n' + m + ')' ];
      let minIdx = -1;
      for (const p of patterns) {
        const idx = cleanText.indexOf(p, fromIndex);
        if (idx !== -1 && (minIdx === -1 || idx < minIdx)) minIdx = idx;
      }
      return minIdx;
    };
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
        while (markerEnd < cleanText.length && (cleanText[markerEnd] === ' ' || cleanText[markerEnd] === '\n' || markers.includes(cleanText[markerEnd]) || ['.', ')'].includes(cleanText[markerEnd]))) markerEnd++;
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
      if (q.type === 'creative') {
        return { 
          ...common,
          stimulus: p.main || '', 
          qA: p.k || '', 
          qB: p.kh || '', 
          qC: p.g || '', 
          qD: p.gh || '' 
        };
      }
      if (q.type === 'mcq') {
        return { 
          ...common,
          mcqQuestion: p.main || '', 
          optA: p.k || '', 
          optB: p.kh || '', 
          optC: p.g || '', 
          optD: p.gh || '' 
        };
      }
      return { ...common, shortText: q.content || '' };
    });

    const docId = editId || doc(collection(db, 'questions')).id;
    
    const data: any = {
      institution: meta.institution || 'টপ গ্রেড টিউটোরিয়ালস',
      exam: meta.exam || '',
      chapter: meta.chapter || '',
      classId: meta.classId || '',
      subject: meta.subject || '',
      time: meta.time || '',
      totalMarks: meta.totalMarks || '',
      creativeInstruction: meta.creativeInstruction || '',
      shortInstruction: meta.shortInstruction || '',
      mcqInstruction: meta.mcqInstruction || 'সঠিক উত্তরের বৃত্তটি ভরাট করো',
      marksA: meta.marksA || 1,
      marksB: meta.marksB || 2,
      marksC: meta.marksC || 3,
      marksD: meta.marksD || 4,
      shortMarks: meta.shortMarks || 2,
      mcqMarks: meta.mcqMarks || 1,
      questions: formattedQuestions,
      userId: user.uid,
      updatedAt: serverTimestamp(),
      isMcq: questions.some(q => q.type === 'mcq')
    };

    if (!editId) {
      data.createdAt = serverTimestamp();
    }

    const ref = doc(db, 'questions', docId);
    setDoc(ref, data, { merge: true })
      .then(() => { 
        setSaving(false); 
        toast({ title: "সফল!", description: "ডাটাবেসে সেভ হয়েছে।" }); 
        if (!editId) router.replace(`/create-question?id=${docId}`); 
      })
      .catch(async () => { 
        setSaving(false); 
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: ref.path, operation: 'write', requestResourceData: data 
        })); 
      });
  };

  const isEnglish = meta.subject?.toLowerCase().includes('english') || meta.subject?.toLowerCase().includes('ইংরেজি');

  if (loading || userLoading) return <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]"><Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /><p className="text-muted-foreground">অ্যাক্সেস চেক করা হচ্ছে...</p></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      <div className="no-print space-y-8">
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm"><FileText className="w-7 h-7" /></div>
            <h2 className="text-2xl font-bold text-primary">প্রশ্নপত্র নির্মাতা</h2>
          </div>
          <Button variant="ghost" onClick={() => router.push('/my-questions')} className="gap-2"><ArrowLeft className="w-4 h-4" /> আমার প্রশ্নসমূহ</Button>
        </header>

        <Card className="shadow-md">
          <CardHeader className="bg-primary/5 border-b py-3"><CardTitle className="text-base flex items-center gap-2 font-bold"><BookOpen className="w-4 h-4 text-primary" /> পরীক্ষার তথ্য ও মান বণ্টন</CardTitle></CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2"><label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label><Input value={meta.institution || ''} onChange={e => setMeta(prev => ({...prev, institution: e.target.value}))} /></div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">পরীক্ষার নাম / ধরন</label>
                <Select onValueChange={v => setMeta(prev => ({...prev, exam: v}))} value={meta.exam || ''}>
                  <SelectTrigger><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="অধ্যায় ভিত্তিক পরীক্ষা">অধ্যায় ভিত্তিক পরীক্ষা</SelectItem>
                    <SelectItem value="সাপ্তাহিক পরীক্ষা">সাপ্তাহিক পরীক্ষা</SelectItem>
                    <SelectItem value="মাসিক পরীক্ষা">মাসিক পরীক্ষা</SelectItem>
                    <SelectItem value="অর্ধ-বার্ষিক পরীক্ষা">অর্ধ-বার্ষিক পরীক্ষা</SelectItem>
                    <SelectItem value="বার্ষিক পরীক্ষা">বার্ষিক পরীক্ষা</SelectItem>
                    <SelectItem value="মডেল টেস্ট">মডেল টেস্ট</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><label className="text-sm font-semibold">সময়</label><Input value={meta.time || ''} onChange={e => setMeta(prev => ({...prev, time: e.target.value}))} /></div>
              <div className="space-y-2"><label className="text-sm font-semibold">পূর্ণমান</label><Input value={meta.totalMarks || ''} onChange={e => setMeta(prev => ({...prev, totalMarks: e.target.value}))} /></div>
              <div className="space-y-2"><label className="text-sm font-semibold">শ্রেণি</label><Select onValueChange={v => setMeta(prev => ({...prev, classId: v}))} value={meta.classId || ''}><SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger><SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><label className="text-sm font-semibold">বিষয়</label><Select onValueChange={v => setMeta(prev => ({...prev, subject: v}))} value={meta.subject || ''} disabled={!meta.classId}><SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">অধ্যায় (ঐচ্ছিক)</label>
                <Select onValueChange={v => setMeta(prev => ({...prev, chapter: v}))} value={meta.chapter || ''} disabled={!meta.subject}>
                  <SelectTrigger><SelectValue placeholder="অধ্যায় নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    {chapters.map(ch => (
                      <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="text-sm font-bold mb-4 text-primary">মান বণ্টন ও নির্দেশনা</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2"><label className="text-xs font-semibold">সৃজনশীল নির্দেশিকা</label><Input value={meta.creativeInstruction || ''} onChange={e => setMeta(prev => ({...prev, creativeInstruction: e.target.value}))} /></div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1"><label className="text-[10px] font-bold">ক</label><Input type="number" value={meta.marksA || ''} onChange={e => setMeta(prev => ({...prev, marksA: parseInt(e.target.value) || 0}))} className="h-8" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold">খ</label><Input type="number" value={meta.marksB || ''} onChange={e => setMeta(prev => ({...prev, marksB: parseInt(e.target.value) || 0}))} className="h-8" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold">গ</label><Input type="number" value={meta.marksC || ''} onChange={e => setMeta(prev => ({...prev, marksC: parseInt(e.target.value) || 0}))} className="h-8" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold">ঘ</label><Input type="number" value={meta.marksD || ''} onChange={e => setMeta(prev => ({...prev, marksD: parseInt(e.target.value) || 0}))} className="h-8" /></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2"><label className="text-xs font-semibold">সংক্ষিপ্ত নির্দেশিকা</label><Input value={meta.shortInstruction || ''} onChange={e => setMeta(prev => ({...prev, shortInstruction: e.target.value}))} /></div>
                  <div className="space-y-2"><label className="text-xs font-semibold">এমসিকিউ নির্দেশিকা</label><Input value={meta.mcqInstruction || ''} onChange={e => setMeta(prev => ({...prev, mcqInstruction: e.target.value}))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="text-[10px] font-bold">সংক্ষিপ্ত মার্কস</label><Input type="number" value={meta.shortMarks || ''} onChange={e => setMeta(prev => ({...prev, shortMarks: parseInt(e.target.value) || 0}))} className="h-8" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold">এমসিকিউ মার্কস</label><Input type="number" value={meta.mcqMarks || ''} onChange={e => setMeta(prev => ({...prev, mcqMarks: parseInt(e.target.value) || 0}))} className="h-8" /></div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-bold">প্রশ্নসমূহ ({questions.length})</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleAddQuestion('creative')} className="border-primary text-primary"><Plus className="w-3 h-3" /> সৃজনশীল</Button>
            <Button variant="outline" size="sm" onClick={() => handleAddQuestion('short')} className="border-accent text-accent"><Plus className="w-3 h-3" /> সংক্ষিপ্ত</Button>
            <Button variant="outline" size="sm" onClick={() => handleAddQuestion('mcq')} className="border-orange-500 text-orange-500"><Plus className="w-3 h-3" /> বহুনির্বাচনি</Button>
          </div>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleImageUpload} 
        />

        {questions.map((q, idx) => (
          <Card key={q.id} className={`relative border-l-4 ${q.type === 'mcq' ? 'border-l-orange-500' : q.type === 'short' ? 'border-l-accent' : 'border-l-primary'}`}>
            <div className="absolute top-2 right-2 no-print flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-primary h-8 w-8" 
                onClick={() => {
                  setActiveQuestionId(q.id);
                  fileInputRef.current?.click();
                }}
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setQuestions(prev => prev.filter(item => item.id !== q.id))}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${q.type === 'mcq' ? 'bg-orange-100 text-orange-600' : q.type === 'short' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>{q.type === 'mcq' ? 'বহুনির্বাচনি' : q.type === 'short' ? 'সংক্ষিপ্ত' : 'সৃজনশীল'}</span>
                <span className="text-sm font-bold">প্রশ্ন নং: {isEnglish ? (idx + 1) : toBengaliNumber(idx + 1)}</span>
              </div>
              <Textarea placeholder={q.type === 'mcq' ? "প্রশ্ন ও অপশনগুলো ক. খ. গ. ঘ. সহ লিখুন" : "উদ্দীপক ও প্রশ্ন ক. খ. গ. ঘ. সহ লিখুন"} value={q.content || ''} onChange={e => setQuestions(prev => prev.map(item => item.id === q.id ? {...item, content: e.target.value} : item))} className="min-h-[120px] text-sm" />
              
              {q.imageUrl && (
                <div className="relative w-full max-w-sm rounded-lg border overflow-hidden bg-muted/20">
                  <img src={q.imageUrl} alt="Question Diagram" className="w-full h-auto object-contain" />
                  <button 
                    onClick={() => setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, imageUrl: '' } : item))}
                    className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <div className="flex gap-4 pt-8">
          <Button onClick={handleSaveToDb} disabled={saving} className="gap-2 px-8 font-bold"><Save className="w-4 h-4" /> সেভ করুন</Button>
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
              height: auto !important;
              overflow: visible !important;
            }
            .paper { 
              width: 100% !important; 
              text-align: justify; 
              position: static !important;
              display: block !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .header { text-align: center; margin-bottom: 6px; border-bottom: 1.5pt solid black; padding-bottom: 4px; }
            .inst-name { font-size: 15pt; font-weight: 800; }
            .meta-info { display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; font-size: 9.5pt; }
            .section { margin-top: 4px; clear: both; }
            .section-label { font-size: 10pt; font-weight: bold; border-bottom: 1pt solid black; display: inline-block; padding: 0 15px; margin: 2px auto; text-transform: uppercase; }
            .instruction { font-style: italic; font-size: 9pt; text-align: center; margin-bottom: 2px; }
            .q-block { margin-bottom: 4px; break-inside: avoid; }
            .stimulus { margin-bottom: 1px; white-space: pre-wrap; display: block; text-align: justify; font-size: 9pt; }
            .q-image { max-width: 250px; margin: 4px auto; display: block; border: 0.5pt solid #eee; }
            .sub-q { display: flex; justify-content: space-between; width: 100%; margin-bottom: 0px; font-size: 9pt; }
            .q-text-part { flex: 1; padding-right: 15px; }
            .mark { font-weight: bold; width: 35px; text-align: right; }
            
            .mcq-container-print {
              column-count: 2;
              column-gap: 20px;
              column-rule: 0.5pt solid #000;
              display: block;
              width: 100%;
              margin-top: 4px;
              font-size: 8pt;
            }
            
            .mcq-row { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 0px 10px; 
              margin-top: 0px; 
              padding-left: 15px; 
              font-size: 8pt; 
            }
            .mcq-opt { display: flex; gap: 4px; align-items: flex-start; }
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
        <div className="paper">
          <div className="header">
            <div className="inst-name">{meta.institution || 'শিক্ষা প্রতিষ্ঠানের নাম'}</div>
            <div className="font-bold text-lg leading-none">{meta.exam || 'পরীক্ষার নাম'}</div>
            <div className="font-bold text-sm">শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || ''} | বিষয়: {meta.subject}</div>
            {meta.chapter && <div className="font-bold text-xs">অধ্যায়: {meta.chapter}</div>}
            <div className="meta-info"><div>সময়: {meta.time}</div><div>পূর্ণমান: {meta.totalMarks}</div></div>
          </div>

          {questions.some(q => q.type === 'creative') && (
            <div className="section">
              <div className="text-center"><div className="section-label">সৃজনশীল প্রশ্ন</div></div>
              <div className="instruction">{meta.creativeInstruction}</div>
              {questions.filter(q => q.type === 'creative').map((q, idx) => {
                const qNum = isEnglish ? (idx + 1) : toBengaliNumber(idx + 1);
                const p = parseText(q.content || '');
                return (
                  <div key={q.id} className="q-block">
                    <div className="font-bold mb-0.5">{qNum}. উদ্দীপকটি পড়ো এবং প্রশ্নগুলোর উত্তর দাও:</div>
                    <div className="stimulus" dangerouslySetInnerHTML={{ __html: formatMath(p.main) }} />
                    {q.imageUrl && <img src={q.imageUrl} className="q-image" alt="Question" />}
                    {['ক', 'খ', 'গ', 'ঘ'].map((l, i) => {
                      const text = (p as any)[i === 0 ? 'k' : i === 1 ? 'kh' : i === 2 ? 'g' : 'gh'];
                      const mark = i === 0 ? meta.marksA : i === 1 ? meta.marksB : i === 2 ? meta.marksC : meta.marksD;
                      return text && (
                        <div key={l} className="sub-q">
                          <span className="q-text-part" dangerouslySetInnerHTML={{ __html: `${l}. ${formatMath(text)}` }} />
                          <span className="mark">{isEnglish ? mark : toBengaliNumber(mark)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {questions.some(q => q.type === 'short') && (
            <div className="section">
              <div className="text-center"><div className="section-label">সংক্ষিপ্ত প্রশ্ন</div></div>
              <div className="instruction">{meta.shortInstruction}</div>
              {questions.filter(q => q.type === 'short').map((q, idx) => {
                const qNum = isEnglish ? (idx + 1) : toBengaliNumber(idx + 1);
                return (
                  <div key={q.id} className="q-block">
                    <div className="sub-q">
                      <span className="q-text-part" dangerouslySetInnerHTML={{ __html: `${qNum}. ${formatMath(q.content || '')}` }} />
                      <span className="mark">{isEnglish ? meta.shortMarks : toBengaliNumber(meta.shortMarks)}</span>
                    </div>
                    {q.imageUrl && <img src={q.imageUrl} className="q-image" alt="Question" />}
                  </div>
                );
              })}
            </div>
          )}

          {questions.some(q => q.type === 'mcq') && (
            <div className="section">
              <div className="text-center"><div className="section-label">বহুনির্বাচনি প্রশ্ন</div></div>
              <div className="instruction">{meta.mcqInstruction}</div>
              <div className="mcq-container-print">
                {questions.filter(q => q.type === 'mcq').map((q, idx) => {
                  const p = parseText(q.content || '');
                  const qNum = isEnglish ? (idx + 1) : toBengaliNumber(idx + 1);
                  return (
                    <div key={q.id} className="q-block">
                      <div className="font-bold mb-0.5" dangerouslySetInnerHTML={{ __html: `${qNum}. ${formatMath(p.main)}` }} />
                      {q.imageUrl && <img src={q.imageUrl} className="q-image" alt="Question" />}
                      <div className="mcq-row">
                        <div className="mcq-opt"><span className="font-bold">ক)</span> <span dangerouslySetInnerHTML={{ __html: formatMath(p.k) }} /></div>
                        <div className="mcq-opt"><span className="font-bold">খ)</span> <span dangerouslySetInnerHTML={{ __html: formatMath(p.kh) }} /></div>
                        <div className="mcq-opt"><span className="font-bold">গ)</span> <span dangerouslySetInnerHTML={{ __html: formatMath(p.g) }} /></div>
                        <div className="mcq-opt"><span className="font-bold">ঘ)</span> <span dangerouslySetInnerHTML={{ __html: formatMath(p.gh) }} /></div>
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
  );
}

export default function CreateQuestionPage() { return <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>}><CreateQuestionContent /></Suspense>; }
