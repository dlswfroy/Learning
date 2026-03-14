
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Plus, Trash2, BookOpen, Save, FileText, ArrowLeft, Loader2, AlertTriangle, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generatePracticeQuestions } from '@/ai/flows/generate-practice-questions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Question = {
  id: string;
  type: 'creative' | 'short' | 'mcq';
  content?: string; // For Written
  // For MCQ
  mcqQuestion?: string;
  optA?: string;
  optB?: string;
  optC?: string;
  optD?: string;
  correctOpt?: string;
};

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function formatMath(text: string) {
  if (!text) return '';
  let formatted = text;
  formatted = formatted.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/\^(\d+|[a-z]|[A-Z])/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/_(\d+|[a-z]|[A-Z])/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-sqrt-stem">$1</span></span>');
  formatted = formatted
    .replace(/\\triangle/g, '△').replace(/\\angle/g, '∠').replace(/\\circ/g, '°')
    .replace(/\\theta/g, 'θ').replace(/\\pi/g, 'π').replace(/\\pm/g, '±')
    .replace(/\\times/g, '×').replace(/\\neq/g, '≠').replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥').replace(/\\degree/g, '°');
  return formatted;
}

function CreateQuestionContent() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const editId = searchParams.get('id');
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [meta, setMeta] = useState({
    institution: '',
    exam: '',
    classId: '',
    subject: '',
    time: '২ ঘণ্টা ৩০ মিনিট',
    totalMarks: '১০০',
    creativeInstruction: 'যেকোনো ৭টি প্রশ্নের উত্তর দাও',
    shortInstruction: 'সকল প্রশ্নের উত্তর দাও',
    mcqInstruction: 'সঠিক উত্তরের বৃত্তটি ভরাট করো',
    marksA: 1,
    marksB: 2,
    marksC: 3,
    marksD: 4,
    shortMarks: 2,
    mcqMarks: 1
  });

  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (!userLoading && !user) router.push('/auth');
  }, [user, userLoading, router]);

  useEffect(() => {
    async function loadQuestion() {
      if (!editId || !db || !user) return;
      try {
        const docRef = doc(db, 'questions', editId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.userId !== user.uid) { router.push('/my-questions'); return; }
          setMeta({
            institution: data.institution || '', exam: data.exam || '', classId: data.classId || '',
            subject: data.subject || '', time: data.time || '', totalMarks: data.totalMarks || '',
            creativeInstruction: data.creativeInstruction || '', shortInstruction: data.shortInstruction || '',
            mcqInstruction: data.mcqInstruction || 'সঠিক উত্তরের বৃত্তটি ভরাট করো',
            marksA: data.marksA || 1, marksB: data.marksB || 2, marksC: data.marksC || 3, marksD: data.marksD || 4,
            shortMarks: data.shortMarks || 2, mcqMarks: data.mcqMarks || 1
          });
          const reconstructed = data.questions.map((q: any) => {
            const id = Math.random().toString(36).substr(2, 9);
            if (q.type === 'mcq') {
              return { id, type: 'mcq', mcqQuestion: q.mcqQuestion, optA: q.optA, optB: q.optB, optC: q.optC, optD: q.optD, correctOpt: q.correctOpt };
            }
            if (q.type === 'creative') {
              let content = q.stimulus || '';
              const parts = [];
              if (q.qA) parts.push(`ক. ${q.qA}`);
              if (q.qB) parts.push(`খ. ${q.qB}`);
              if (q.qC) parts.push(`গ. ${q.qC}`);
              if (q.qD) parts.push(`ঘ. ${q.qD}`);
              return { id, type: 'creative', content: content + (parts.length > 0 ? '\n' + parts.join('\n') : '') };
            }
            return { id, type: 'short', content: q.shortText || '' };
          });
          setQuestions(reconstructed);
        }
      } catch (e) {} finally { setLoading(false); }
    }
    if (user && db) loadQuestion();
  }, [editId, db, user, router]);

  const subjects = useMemo(() => meta.classId ? getSubjectsForClass(meta.classId) : [], [meta.classId]);

  const handleAddQuestion = (type: 'creative' | 'short' | 'mcq') => {
    const newQ: Question = { id: Math.random().toString(36).substr(2, 9), type };
    if (type !== 'mcq') newQ.content = '';
    else { newQ.mcqQuestion = ''; newQ.optA = ''; newQ.optB = ''; newQ.optC = ''; newQ.optD = ''; newQ.correctOpt = ''; }
    setQuestions(prev => [...prev, newQ]);
  };

  const handleAiGenerate = async (type: 'creative' | 'short' | 'mcq') => {
    if (!meta.classId || !meta.subject) {
      toast({ title: "তথ্য দিন", description: "প্রথমে শ্রেণি ও বিষয় নির্বাচন করুন।", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const result = await generatePracticeQuestions({ classId: meta.classId, subject: meta.subject, type: type === 'creative' ? 'creative' : type === 'short' ? 'short' : 'mcq', count: 5 });
      const newQs = result.questions.map(q => {
        const id = Math.random().toString(36).substr(2, 9);
        if (q.type === 'mcq') {
          return { id, type: 'mcq', mcqQuestion: q.mcqQuestion, optA: q.optA, optB: q.optB, optC: q.optC, optD: q.optD, correctOpt: q.correctOpt };
        }
        if (q.type === 'creative') {
          return { id, type: 'creative', content: `${q.stimulus}\nক. ${q.qA}\nখ. ${q.qB}\nগ. ${q.qC}\nঘ. ${q.qD}` };
        }
        return { id, type: 'short', content: q.shortText };
      });
      setQuestions(prev => [...prev, ...newQs]);
      toast({ title: "সফল", description: "AI প্রশ্নপত্র তৈরি করেছে।" });
    } catch (e) {
      toast({ title: "ত্রুটি", description: "প্রশ্ন তৈরিতে সমস্যা হয়েছে।", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const parseCreative = (text: string) => {
    const parts = { stimulus: '', qA: '', qB: '', qC: '', qD: '' };
    if (!text) return parts;
    const markers = ['ক.', 'খ.', 'গ.', 'ঘ.'];
    let positions = markers.map(m => text.indexOf(m));
    const firstMarkerIndex = positions.findIndex(p => p !== -1);
    if (firstMarkerIndex !== -1) {
      parts.stimulus = text.substring(0, positions[firstMarkerIndex]).trim();
      for (let i = 0; i < markers.length; i++) {
        const start = positions[i]; if (start === -1) continue;
        let end = text.length;
        for (let j = i + 1; j < markers.length; j++) { if (positions[j] !== -1) { end = positions[j]; break; } }
        const content = text.substring(start + markers[i].length, end).trim();
        if (i === 0) parts.qA = content; else if (i === 1) parts.qB = content; else if (i === 2) parts.qC = content; else if (i === 3) parts.qD = content;
      }
    } else { parts.stimulus = text.trim(); }
    return parts;
  };

  const handleSaveToDb = () => {
    if (!user) { toast({ title: "লগইন প্রয়োজন", variant: "destructive" }); return; }
    setSaving(true);
    const formattedQuestions = questions.map(q => {
      if (q.type === 'creative') {
        const p = parseCreative(q.content || '');
        return { type: 'creative', stimulus: p.stimulus, qA: p.qA, qB: p.qB, qC: p.qC, qD: p.qD };
      }
      if (q.type === 'mcq') return { type: 'mcq', mcqQuestion: q.mcqQuestion, optA: q.optA, optB: q.optB, optC: q.optC, optD: q.optD, correctOpt: q.correctOpt };
      return { type: 'short', shortText: q.content };
    });
    const docId = editId || doc(collection(db!, 'questions')).id;
    const data = {
      ...meta, questions: formattedQuestions, userId: user.uid, updatedAt: serverTimestamp(),
      isMcq: questions.some(q => q.type === 'mcq'),
      ...(editId ? {} : { createdAt: serverTimestamp() })
    };
    const ref = doc(db!, 'questions', docId);
    setDoc(ref, data, { merge: true }).then(() => {
      setSaving(false); toast({ title: "সফল!", description: "ডাটাবেসে সেভ হয়েছে।" });
      if (!editId) router.replace(`/create-question?id=${docId}`);
    }).catch(async () => {
      setSaving(false); errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'write', requestResourceData: data }));
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
              {['institution', 'exam', 'time', 'totalMarks'].map(f => (
                <div key={f} className="space-y-2">
                  <label className="text-sm font-semibold">{f === 'institution' ? 'প্রতিষ্ঠানের নাম' : f === 'exam' ? 'পরীক্ষার নাম' : f === 'time' ? 'সময়' : 'পূর্ণমান'}</label>
                  <Input value={(meta as any)[f] || ''} onChange={e => setMeta(prev => ({...prev, [f]: e.target.value}))} />
                </div>
              ))}
              <div className="space-y-2">
                <label className="text-sm font-semibold">শ্রেণি</label>
                <Select onValueChange={v => setMeta(prev => ({...prev, classId: v}))} value={meta.classId || ''}><SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger><SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">বিষয়</label>
                <Select onValueChange={v => setMeta(prev => ({...prev, subject: v}))} value={meta.subject || ''} disabled={!meta.classId}><SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t pt-6">
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-primary">সৃজনশীল মান (ক-ঘ)</h4>
                <div className="flex gap-2">
                  {['marksA', 'marksB', 'marksC', 'marksD'].map(m => <Input key={m} type="number" value={(meta as any)[m]} onChange={e => setMeta(prev => ({...prev, [m]: parseInt(e.target.value) || 0}))} className="h-8 text-center" />)}
                </div>
              </div>
              <div className="space-y-2"><h4 className="text-sm font-bold text-accent">সংক্ষিপ্ত মান</h4><Input type="number" value={meta.shortMarks} onChange={e => setMeta(prev => ({...prev, shortMarks: parseInt(e.target.value) || 0}))} className="h-8 text-center w-20" /></div>
              <div className="space-y-2"><h4 className="text-sm font-bold text-orange-500">MCQ মান</h4><Input type="number" value={meta.mcqMarks} onChange={e => setMeta(prev => ({...prev, mcqMarks: parseInt(e.target.value) || 0}))} className="h-8 text-center w-20" /></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['creativeInstruction', 'shortInstruction', 'mcqInstruction'].map(f => (
            <div key={f} className="space-y-2">
              <label className="text-sm font-bold">{f === 'creativeInstruction' ? 'সৃজনশীল নির্দেশ' : f === 'shortInstruction' ? 'সংক্ষিপ্ত নির্দেশ' : 'MCQ নির্দেশ'}</label>
              <Input value={(meta as any)[f] || ''} onChange={e => setMeta(prev => ({...prev, [f]: e.target.value}))} />
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-bold">প্রশ্নসমূহ ({questions.length})</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('creative')} className="border-primary text-primary"><Plus className="w-3 h-3" /> সৃজনশীল</Button>
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('short')} className="border-accent text-accent"><Plus className="w-3 h-3" /> সংক্ষিপ্ত</Button>
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('mcq')} className="border-orange-500 text-orange-500"><Plus className="w-3 h-3" /> MCQ</Button>
              <div className="h-6 w-px bg-border mx-1" />
              <Button size="sm" onClick={() => handleAiGenerate('creative')} disabled={generating} className="bg-primary text-white"><BrainCircuit className="w-3 h-3" /> AI সৃজনশীল</Button>
              <Button size="sm" onClick={() => handleAiGenerate('mcq')} disabled={generating} className="bg-orange-500 text-white"><BrainCircuit className="w-3 h-3" /> AI MCQ</Button>
            </div>
          </div>

          {questions.map((q, idx) => (
            <Card key={q.id} className={`relative border-l-4 group ${q.type === 'mcq' ? 'border-l-orange-500' : q.type === 'creative' ? 'border-l-primary' : 'border-l-accent'}`}>
              <div className="absolute top-2 right-2 no-print">
                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setQuestions(prev => prev.filter(item => item.id !== q.id))}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${q.type === 'mcq' ? 'bg-orange-100 text-orange-600' : q.type === 'creative' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                    {q.type === 'mcq' ? 'বহুনির্বাচনি' : q.type === 'creative' ? 'সৃজনশীল' : 'সংক্ষিপ্ত'}
                  </span>
                  <span className="text-sm font-bold">প্রশ্ন নং: {isEnglish ? (idx + 1) : toBengaliNumber(idx + 1)}</span>
                </div>
                
                {q.type === 'mcq' ? (
                  <div className="space-y-4">
                    <Input placeholder="প্রশ্নটি লিখুন..." value={q.mcqQuestion || ''} onChange={e => setQuestions(prev => prev.map(item => item.id === q.id ? {...item, mcqQuestion: e.target.value} : item))} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {['optA', 'optB', 'optC', 'optD'].map((opt, i) => (
                        <div key={opt} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">{['ক.', 'খ.', 'গ.', 'ঘ.'][i]}</span>
                          <Input placeholder="অপশন লিখুন" value={(q as any)[opt] || ''} onChange={e => setQuestions(prev => prev.map(item => item.id === q.id ? {...item, [opt]: e.target.value} : item))} className="h-9" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Textarea placeholder={q.type === 'creative' ? "উদ্দীপক ও প্রশ্ন একসাথে (ক. খ. গ. ঘ. সহ) লিখুন।" : "সংক্ষিপ্ত প্রশ্ন লিখুন..."} value={q.content || ''} onChange={e => setQuestions(prev => prev.map(item => item.id === q.id ? {...item, content: e.target.value} : item))} className="min-h-[100px] text-sm" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-4 pt-8">
          <Button onClick={handleSaveToDb} disabled={saving} className="gap-2 px-8 font-bold"><Save className="w-4 h-4" /> {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</Button>
          <Button onClick={() => window.print()} variant="secondary" className="gap-2 px-10 shadow-lg font-bold"><Printer className="w-4 h-4" /> প্রিন্ট / পিডিএফ</Button>
        </div>
      </div>

      <div className="print-only">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { size: A4; margin: 0in; }
            body { font-family: 'Inter', sans-serif; font-size: 10pt; color: black !important; line-height: 1.1 !important; background: white !important; margin: 0; padding: 0; }
            .paper { width: 100%; padding: 0.5in; text-align: justify; }
            .header { text-align: center; margin-bottom: 8px; border-bottom: 1.5pt solid black; padding-bottom: 6px; }
            .inst-name { font-size: 16pt; font-weight: 800; }
            .meta-info { display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; }
            .section { margin-top: 10px; }
            .section-label { font-size: 10pt; font-weight: bold; border-bottom: 1pt solid black; display: inline-block; padding: 0 15px; margin: 5px auto; }
            .instruction { font-style: italic; font-size: 9pt; text-align: center; margin-bottom: 5px; display: block; }
            .q-block { margin-bottom: 8px; page-break-inside: avoid; clear: both; }
            .stimulus { margin-bottom: 2px; white-space: pre-wrap; display: block; }
            .sub-q { display: flex; justify-content: space-between; line-height: 1.2; width: 100%; }
            .q-text-part { flex: 1; padding-right: 15px; }
            .mark { font-weight: bold; width: 40px; text-align: right; }
            .mcq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-top: 2px; padding-left: 15px; }
            .mcq-opt { display: flex; gap: 4px; }
            .no-print { display: none !important; }
          }
        `}} />
        <div className="paper">
          <div className="header">
            <div className="inst-name">{meta.institution || 'শিক্ষা প্রতিষ্ঠানের নাম'}</div>
            <div className="font-bold">{meta.exam || 'পরীক্ষার নাম'}</div>
            <div className="font-bold">শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || ''} | বিষয়: {meta.subject}</div>
            <div className="meta-info"><div>সময়: {meta.time}</div><div>পূর্ণমান: {meta.totalMarks}</div></div>
          </div>

          {questions.some(q => q.type === 'creative') && (
            <div className="section">
              <div className="text-center"><div className="section-label">সৃজনশীল প্রশ্ন</div></div>
              <div className="instruction">{meta.creativeInstruction}</div>
              {questions.filter(q => q.type === 'creative').map((q, idx) => {
                const p = parseCreative(q.content || '');
                const qNum = isEnglish ? (idx + 1) : toBengaliNumber(idx + 1);
                return (
                  <div key={q.id} className="q-block">
                    <div className="font-bold">{qNum}. উদ্দীপকটি পড়ো এবং প্রশ্নগুলোর উত্তর দাও:</div>
                    <div className="stimulus" dangerouslySetInnerHTML={{ __html: formatMath(p.stimulus) }} />
                    {['ক', 'খ', 'গ', 'ঘ'].map((l, i) => {
                      const text = (p as any)[`q${l}`];
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
                  <div key={q.id} className="q-block sub-q">
                    <span className="q-text-part" dangerouslySetInnerHTML={{ __html: `${qNum}. ${formatMath(q.content || '')}` }} />
                    <span className="mark">{isEnglish ? meta.shortMarks : toBengaliNumber(meta.shortMarks)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {questions.some(q => q.type === 'mcq') && (
            <div className="section">
              <div className="text-center"><div className="section-label">বহুনির্বাচনি প্রশ্ন</div></div>
              <div className="instruction">{meta.mcqInstruction}</div>
              {questions.filter(q => q.type === 'mcq').map((q, idx) => {
                const qNum = isEnglish ? (idx + 1) : toBengaliNumber(idx + 1);
                return (
                  <div key={q.id} className="q-block">
                    <div className="sub-q">
                      <span className="q-text-part" dangerouslySetInnerHTML={{ __html: `${qNum}. ${formatMath(q.mcqQuestion || '')}` }} />
                      <span className="mark">{isEnglish ? meta.mcqMarks : toBengaliNumber(meta.mcqMarks)}</span>
                    </div>
                    <div className="mcq-grid">
                      {['ক', 'খ', 'গ', 'ঘ'].map((l, i) => {
                        const opt = (q as any)[`opt${String.fromCharCode(65 + i)}`];
                        return opt && (
                          <div key={l} className="mcq-opt">
                            <span className="font-bold">{l})</span>
                            <span dangerouslySetInnerHTML={{ __html: formatMath(opt) }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CreateQuestionPage() {
  return <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>}><CreateQuestionContent /></Suspense>;
}
