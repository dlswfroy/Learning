
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Plus, Trash2, BookOpen, Save, FileText, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
  type: 'creative' | 'short';
  content: string; 
};

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function formatMath(text: string) {
  if (!text) return '';
  
  let formatted = text;
  
  formatted = formatted.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, 
    '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
  
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/\^(\d+|[a-z]|[A-Z])/g, '<sup class="math-sup">$1</sup>');
  
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/_(\d+|[a-z]|[A-Z])/g, '<sub class="math-sub">$1</sub>');
  
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-sqrt-stem">$1</span></span>');
  
  formatted = formatted
    .replace(/\\triangle/g, '△')
    .replace(/\\angle/g, '∠')
    .replace(/\\circ/g, '°')
    .replace(/\\theta/g, 'θ')
    .replace(/\\pi/g, 'π')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\neq/g, '≠')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\degree/g, '°');
    
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

  const [meta, setMeta] = useState({
    institution: '',
    exam: '',
    classId: '',
    subject: '',
    time: '২ ঘণ্টা ৩০ মিনিট',
    totalMarks: '১০০',
    creativeInstruction: 'যেকোনো ৭টি প্রশ্নের উত্তর দাও',
    shortInstruction: 'সকল প্রশ্নের উত্তর দাও',
    marksA: 1,
    marksB: 2,
    marksC: 3,
    marksD: 4,
    shortMarks: 2
  });

  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (!editId) {
      const draft = localStorage.getItem('question_draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setMeta(prev => ({ ...prev, ...parsed.meta }));
          setQuestions(parsed.questions || []);
        } catch (e) {}
      }
    }
  }, [editId]);

  useEffect(() => {
    if (!editId && questions.length > 0) {
      localStorage.setItem('question_draft', JSON.stringify({ meta, questions }));
    }
  }, [meta, questions, editId]);

  useEffect(() => {
    async function loadQuestion() {
      if (!editId || !db || !user) return;
      try {
        const docRef = doc(db, 'questions', editId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.userId !== user.uid) {
            router.push('/my-questions');
            return;
          }

          setMeta({
            institution: data.institution || '',
            exam: data.exam || '',
            classId: data.classId || '',
            subject: data.subject || '',
            time: data.time || '',
            totalMarks: data.totalMarks || '',
            creativeInstruction: data.creativeInstruction || '',
            shortInstruction: data.shortInstruction || '',
            marksA: data.marksA || 1,
            marksB: data.marksB || 2,
            marksC: data.marksC || 3,
            marksD: data.marksD || 4,
            shortMarks: data.shortMarks || 2
          });
          
          const reconstructed = data.questions.map((q: any) => {
            const id = Math.random().toString(36).substr(2, 9);
            if (q.type === 'creative') {
              let content = q.stimulus || '';
              const parts = [];
              if (q.qA) parts.push(`ক. ${q.qA}`);
              if (q.qB) parts.push(`খ. ${q.qB}`);
              if (q.qC) parts.push(`গ. ${q.qC}`);
              if (q.qD) parts.push(`ঘ. ${q.qD}`);
              return { 
                id,
                type: 'creative', 
                content: content + (parts.length > 0 ? '\n' + parts.join('\n') : ''),
              };
            }
            return { 
              id,
              type: 'short', 
              content: q.shortText || '', 
            };
          });
          setQuestions(reconstructed);
        }
      } catch (e) {} finally {
        setLoading(false);
      }
    }
    if (user && db) loadQuestion();
  }, [editId, db, user, router]);

  const subjects = useMemo(() => meta.classId ? getSubjectsForClass(meta.classId) : [], [meta.classId]);

  const handleAddQuestion = (type: 'creative' | 'short') => {
    const newQ: Question = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: '',
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, data: Partial<Question>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...data } : q));
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
        const start = positions[i];
        if (start === -1) continue;
        let end = text.length;
        for (let j = i + 1; j < markers.length; j++) {
          if (positions[j] !== -1) {
            end = positions[j];
            break;
          }
        }
        const content = text.substring(start + markers[i].length, end).trim();
        if (i === 0) parts.qA = content;
        else if (i === 1) parts.qB = content;
        else if (i === 2) parts.qC = content;
        else if (i === 3) parts.qD = content;
      }
    } else {
      parts.stimulus = text.trim();
    }
    return parts;
  };

  const handleSaveToDb = () => {
    if (!user) {
      toast({ title: "লগইন প্রয়োজন", description: "প্রশ্নপত্র সেভ করতে লগইন করুন।", variant: "destructive" });
      return;
    }
    setSaving(true);
    const formattedQuestions = questions.map(q => {
      if (q.type === 'creative') {
        const parsed = parseCreative(q.content);
        return {
          type: 'creative',
          stimulus: parsed.stimulus,
          qA: parsed.qA,
          qB: parsed.qB,
          qC: parsed.qC,
          qD: parsed.qD,
        };
      }
      return {
        type: 'short',
        shortText: q.content,
      };
    });

    const docId = editId || doc(collection(db!, 'questions')).id;
    const questionSetData = {
      institution: meta.institution || '',
      exam: meta.exam || '',
      classId: meta.classId || '',
      subject: meta.subject || '',
      time: meta.time || '',
      totalMarks: meta.totalMarks || '',
      creativeInstruction: meta.creativeInstruction || '',
      shortInstruction: meta.shortInstruction || '',
      marksA: meta.marksA,
      marksB: meta.marksB,
      marksC: meta.marksC,
      marksD: meta.marksD,
      shortMarks: meta.shortMarks,
      questions: formattedQuestions,
      userId: user.uid,
      updatedAt: serverTimestamp(),
      ...(editId ? {} : { createdAt: serverTimestamp() })
    };

    const docRef = doc(db!, 'questions', docId);
    setDoc(docRef, questionSetData, { merge: true })
      .then(() => {
        setSaving(false);
        localStorage.removeItem('question_draft');
        toast({ title: "সফল!", description: "প্রশ্নপত্রটি ডাটাবেসে সেভ হয়েছে।" });
        if (!editId) router.replace(`/create-question?id=${docId}`);
      })
      .catch(async () => {
        setSaving(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path, operation: 'write', requestResourceData: questionSetData
        }));
      });
  };

  const isEnglishSubject = meta.subject?.toLowerCase().includes('english') || meta.subject?.toLowerCase().includes('ইংরেজি');
  const creativeQuestions = questions.filter(q => q.type === 'creative');
  const shortQuestions = questions.filter(q => q.type === 'short');

  if (loading || userLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">প্রশ্নপত্র লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      <div className="no-print space-y-8">
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-primary">প্রশ্নপত্র নির্মাতা</h2>
            </div>
          </div>
          <Button variant="ghost" onClick={() => router.push('/my-questions')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> আমার প্রশ্নসমূহ
          </Button>
        </header>

        <Card className="shadow-md">
          <CardHeader className="bg-primary/5 border-b py-3">
            <CardTitle className="text-base flex items-center gap-2 font-bold">
              <BookOpen className="w-4 h-4 text-primary" /> পরীক্ষার তথ্য ও মান বণ্টন
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label>
                <Input value={meta.institution || ''} onChange={e => setMeta(prev => ({...prev, institution: e.target.value}))} placeholder="উদা: বীরগঞ্জ সরকারি উচ্চ বিদ্যালয়" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">পরীক্ষার নাম</label>
                <Input value={meta.exam || ''} onChange={e => setMeta(prev => ({...prev, exam: e.target.value}))} placeholder="উদা: বার্ষিক পরীক্ষা" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">শ্রেণি</label>
                <Select onValueChange={v => setMeta(prev => ({...prev, classId: v}))} value={meta.classId || ''}>
                  <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">বিষয়</label>
                <Select onValueChange={v => setMeta(prev => ({...prev, subject: v}))} value={meta.subject || ''} disabled={!meta.classId}>
                  <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">সময়</label>
                <Input value={meta.time || ''} onChange={e => setMeta(prev => ({...prev, time: e.target.value}))} placeholder="উদা: ২ ঘণ্টা ৩০ মিনিট" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">পূর্ণমান</label>
                <Input value={meta.totalMarks || ''} onChange={e => setMeta(prev => ({...prev, totalMarks: e.target.value}))} placeholder="১০০" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-primary">সৃজনশীল মান (ক-ঘ)</h4>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold">ক</label>
                    <Input type="number" value={meta.marksA} onChange={e => setMeta(prev => ({...prev, marksA: parseInt(e.target.value) || 0}))} className="h-8 text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold">খ</label>
                    <Input type="number" value={meta.marksB} onChange={e => setMeta(prev => ({...prev, marksB: parseInt(e.target.value) || 0}))} className="h-8 text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold">গ</label>
                    <Input type="number" value={meta.marksC} onChange={e => setMeta(prev => ({...prev, marksC: parseInt(e.target.value) || 0}))} className="h-8 text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold">ঘ</label>
                    <Input type="number" value={meta.marksD} onChange={e => setMeta(prev => ({...prev, marksD: parseInt(e.target.value) || 0}))} className="h-8 text-center" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-accent">সংক্ষিপ্ত মান</h4>
                <div className="space-y-1 max-w-[100px]">
                  <label className="text-[10px] font-bold">নম্বর</label>
                  <Input type="number" value={meta.shortMarks} onChange={e => setMeta(prev => ({...prev, shortMarks: parseInt(e.target.value) || 0}))} className="h-8 text-center" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold">সৃজনশীল নির্দেশনা</label>
            <Input value={meta.creativeInstruction || ''} onChange={e => setMeta(prev => ({...prev, creativeInstruction: e.target.value}))} placeholder="যেকোনো ৭টি প্রশ্নের উত্তর দাও" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">সংক্ষিপ্ত নির্দেশনা</label>
            <Input value={meta.shortInstruction || ''} onChange={e => setMeta(prev => ({...prev, shortInstruction: e.target.value}))} placeholder="সকল প্রশ্নের উত্তর দাও" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">প্রশ্নসমূহ ({questions.length})</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('creative')} className="gap-1 border-primary text-primary">
                <Plus className="w-4 h-4" /> সৃজনশীল যোগ
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('short')} className="gap-1 border-accent text-accent">
                <Plus className="w-4 h-4" /> সংক্ষিপ্ত যোগ
              </Button>
            </div>
          </div>

          {questions.map((q, idx) => (
            <Card key={q.id} className="relative border-l-4 border-l-primary group">
              <div className="absolute top-2 right-2 no-print">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive w-5 h-5" /> আপনি কি নিশ্চিত?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        এই প্রশ্নটি স্থায়ীভাবে মুছে ফেলা হবে।
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>বাতিল</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRemoveQuestion(q.id)} className="bg-destructive hover:bg-destructive/90">
                        মুছে ফেলুন
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                    {q.type === 'creative' ? 'সৃজনশীল' : 'সংক্ষিপ্ত'}
                  </span>
                  <span className="text-sm font-bold">প্রশ্ন নং: {isEnglishSubject ? (idx + 1) : toBengaliNumber(idx + 1)}</span>
                </div>
                
                <Textarea 
                  placeholder={q.type === 'creative' ? "উদ্দীপক ও প্রশ্ন একসাথে (ক. খ. গ. ঘ. সহ) লিখুন।" : "সংক্ষিপ্ত প্রশ্ন লিখুন..."} 
                  value={q.content || ''} 
                  onChange={e => updateQuestion(q.id, {content: e.target.value})}
                  className="min-h-[100px] text-sm leading-relaxed"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-4 pt-8">
          <Button onClick={handleSaveToDb} disabled={saving} className="gap-2 px-8 font-bold">
            <Save className="w-4 h-4" /> {saving ? 'সেভ হচ্ছে...' : 'ডাটাবেসে সেভ করুন'}
          </Button>
          <Button onClick={() => window.print()} variant="secondary" className="gap-2 px-10 shadow-lg font-bold">
            <Printer className="w-4 h-4" /> প্রিন্ট / পিডিএফ
          </Button>
        </div>
      </div>

      <div className="print-only">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { 
              size: A4; 
              margin: 0in; 
            }
            body { 
              font-family: 'Inter', sans-serif; 
              font-size: 10pt; 
              color: black !important; 
              line-height: 1.1 !important; 
              background: white !important; 
              margin: 0;
              padding: 0;
            }
            .paper { 
              width: 100%; 
              padding-top: 0.5in; 
              padding-bottom: 0.5in; 
              padding-left: 0.5in; 
              padding-right: 0.5in;
              text-align: justify; 
            }
            .header { text-align: center; margin-bottom: 8px; border-bottom: 1.5pt solid black; padding-bottom: 6px; }
            .inst-name { font-size: 16pt; font-weight: 800; margin-bottom: 0px; }
            .exam-name { font-size: 10pt; font-weight: 700; margin-bottom: 0px; }
            .meta-info { display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; font-size: 10pt; }
            
            .section-header-container { text-align: center; width: 100%; margin-top: 5px; margin-bottom: 2px; }
            .section-label { font-size: 10pt; font-weight: bold; border-bottom: 1pt solid black; display: inline-block; padding: 0 15px; }
            .instruction { font-style: italic; font-size: 9pt; margin-bottom: 2px; text-align: center; display: block; width: 100%; }
            
            .q-block { margin-bottom: 0px; page-break-inside: avoid; clear: both; width: 100%; position: relative; padding-top: 2px; }
            .stimulus { margin-bottom: 1px; white-space: pre-wrap; text-align: justify; display: block; line-height: 1.1; }
            
            .sub-qs { display: flex; flex-direction: column; gap: 0px; margin-top: 0px; }
            .sub-q { display: flex !important; justify-content: space-between !important; align-items: flex-start !important; line-height: 1.1; width: 100%; margin-bottom: 0px; }
            .q-text-part { flex: 1; text-align: justify; padding-right: 15px; }
            .mark { font-weight: bold; width: 40px; text-align: right !important; min-width: 40px; margin-left: 5px; display: inline-block; }
            
            .math-sup { font-size: 0.75em; vertical-align: baseline; position: relative; top: -0.4em; }
            .math-sub { font-size: 0.75em; vertical-align: baseline; position: relative; top: 0.2em; }
            .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.85em; margin: 0 0.15em; line-height: 1; }
            .math-num { display: block; border-bottom: 0.5pt solid black; padding: 0 0.1em; }
            .math-den { display: block; padding: 0 0.1em; }
            .math-sqrt { display: inline-flex; align-items: flex-start; vertical-align: middle; position: relative; }
            .math-sqrt-stem { border-top: 0.5pt solid black; margin-top: 0.5pt; padding-top: 1pt; display: inline-block; line-height: 1; }
            
            .no-print { display: none !important; }
          }
        `}} />
        
        <div className="paper">
          <div className="header">
            <div className="inst-name">{meta.institution || 'শিক্ষা প্রতিষ্ঠানের নাম'}</div>
            <div className="exam-name">{meta.exam || 'পরীক্ষার নাম'}</div>
            <div className="font-bold">শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || ''} | বিষয়: {meta.subject}</div>
            <div className="meta-info">
              <div>সময়: {meta.time}</div>
              <div>পূর্ণমান: {meta.totalMarks}</div>
            </div>
          </div>

          {creativeQuestions.length > 0 && (
            <div className="section">
              <div className="section-header-container">
                <div className="section-label">সৃজনশীল প্রশ্ন</div>
              </div>
              <div className="instruction">{meta.creativeInstruction}</div>
              {creativeQuestions.map((q, idx) => {
                const parsed = parseCreative(q.content);
                const qNum = isEnglishSubject ? (idx + 1) : toBengaliNumber(idx + 1);
                return (
                  <div key={q.id} className="q-block">
                    <div className="font-bold mb-0.5">{qNum}. নিচের উদ্দীপকটি পড়ো এবং প্রশ্নগুলোর উত্তর দাও:</div>
                    <div className="stimulus" dangerouslySetInnerHTML={{ __html: formatMath(parsed.stimulus) }} />
                    <div className="sub-qs">
                      {parsed.qA && (
                        <div className="sub-q">
                          <span className="q-text-part" dangerouslySetInnerHTML={{ __html: 'ক. ' + formatMath(parsed.qA) }} />
                          <span className="mark">{isEnglishSubject ? meta.marksA : toBengaliNumber(meta.marksA)}</span>
                        </div>
                      )}
                      {parsed.qB && (
                        <div className="sub-q">
                          <span className="q-text-part" dangerouslySetInnerHTML={{ __html: 'খ. ' + formatMath(parsed.qB) }} />
                          <span className="mark">{isEnglishSubject ? meta.marksB : toBengaliNumber(meta.marksB)}</span>
                        </div>
                      )}
                      {parsed.qC && (
                        <div className="sub-q">
                          <span className="q-text-part" dangerouslySetInnerHTML={{ __html: 'গ. ' + formatMath(parsed.qC) }} />
                          <span className="mark">{isEnglishSubject ? meta.marksC : toBengaliNumber(meta.marksC)}</span>
                        </div>
                      )}
                      {parsed.qD && (
                        <div className="sub-q">
                          <span className="q-text-part" dangerouslySetInnerHTML={{ __html: 'ঘ. ' + formatMath(parsed.qD) }} />
                          <span className="mark">{isEnglishSubject ? meta.marksD : toBengaliNumber(meta.marksD)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {shortQuestions.length > 0 && (
            <div className="section">
              <div className="section-header-container">
                <div className="section-label">সংক্ষিপ্ত প্রশ্ন</div>
              </div>
              <div className="instruction">{meta.shortInstruction}</div>
              {shortQuestions.map((q, idx) => {
                const globalIdx = creativeQuestions.length + idx;
                const qNum = isEnglishSubject ? (globalIdx + 1) : toBengaliNumber(globalIdx + 1);
                return (
                  <div key={q.id} className="q-block sub-q">
                    <span className="q-text-part" dangerouslySetInnerHTML={{ __html: `${qNum}. ${formatMath(q.content)}` }} />
                    <span className="mark">{isEnglishSubject ? meta.shortMarks : toBengaliNumber(meta.shortMarks)}</span>
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
  return (
    <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>}>
      <CreateQuestionContent />
    </Suspense>
  );
}
