
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Plus, Trash2, BookOpen, Clock, Award, Save, FileText, ArrowLeft, Loader2, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type Question = {
  type: 'creative' | 'short';
  content: string; 
  shortMarks?: number;
};

// উন্নত গাণিতিক সংকেত প্রসেসর (LaTeX-style)
function formatMath(text: string) {
  if (!text) return '';
  return text
    // Fractions: \frac{a}{b}
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span class="math-frac"><sup>$1</sup>/<sub>$2</sub></span>')
    // Superscript: x^2 or x^{100}
    .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
    .replace(/\^(\d+|[a-z]+)/g, '<sup>$1</sup>')
    // Subscript: H_2O or x_{i}
    .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
    .replace(/_(\d+|[a-z]+)/g, '<sub>$1</sub>')
    // Square Root: sqrt(x)
    .replace(/sqrt\(([^)]+)\)/g, '<span class="sqrt">√<span class="sqrt-stem">$1</span></span>')
    .replace(/sqrt/g, '√')
    // Greek Symbols
    .replace(/theta/g, 'θ')
    .replace(/pi/g, 'π')
    .replace(/degree/g, '°')
    // Operators
    .replace(/\+-/g, '±')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠');
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
    marksA: 1,
    marksB: 2,
    marksC: 3,
    marksD: 4,
    creativeInstruction: 'যেকোনো ৭টি প্রশ্নের উত্তর দাও',
    shortInstruction: 'সকল প্রশ্নের উত্তর দাও',
  });

  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (!editId) {
      const savedDraft = localStorage.getItem('question_draft');
      if (savedDraft) {
        try {
          const { meta: dMeta, questions: dQs } = JSON.parse(savedDraft);
          setMeta(prev => ({ ...prev, ...dMeta }));
          setQuestions(dQs || []);
        } catch (e) {}
      }
    }
  }, [editId]);

  useEffect(() => {
    if (!editId && (questions.length > 0 || meta.institution)) {
      localStorage.setItem('question_draft', JSON.stringify({ meta, questions }));
    }
  }, [meta, questions, editId]);

  useEffect(() => {
    async function loadQuestion() {
      if (!editId || !db) return;
      try {
        const docRef = doc(db, 'questions', editId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMeta({
            institution: data.institution || '',
            exam: data.exam || '',
            classId: data.classId || '',
            subject: data.subject || '',
            time: data.time || '',
            totalMarks: data.totalMarks || '',
            marksA: data.marksA || 1,
            marksB: data.marksB || 2,
            marksC: data.marksC || 3,
            marksD: data.marksD || 4,
            creativeInstruction: data.creativeInstruction || '',
            shortInstruction: data.shortInstruction || '',
          });
          
          const reconstructed = data.questions.map((q: any) => {
            if (q.type === 'creative') {
              let content = q.stimulus || '';
              if (q.qA) content += `\nক. ${q.qA}`;
              if (q.qB) content += `\nখ. ${q.qB}`;
              if (q.qC) content += `\nগ. ${q.qC}`;
              if (q.qD) content += `\nঘ. ${q.qD}`;
              return { type: 'creative', content };
            }
            return { type: 'short', content: q.shortText || '', shortMarks: q.shortMarks || 2 };
          });
          setQuestions(reconstructed);
        }
      } catch (e) {} finally {
        setLoading(false);
      }
    }
    loadQuestion();
  }, [editId, db]);

  const subjects = useMemo(() => meta.classId ? getSubjectsForClass(meta.classId) : [], [meta.classId]);

  const handleAddQuestion = (type: 'creative' | 'short') => {
    const newQ: Question = type === 'creative' 
      ? { type, content: '' }
      : { type, content: '', shortMarks: 2 };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, data: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...data };
    setQuestions(updated);
  };

  const parseCreative = (text: string) => {
    const parts = { stimulus: '', qA: '', qB: '', qC: '', qD: '' };
    let currentText = text;

    const posA = currentText.indexOf('ক.');
    const posB = currentText.indexOf('খ.');
    const posC = currentText.indexOf('গ.');
    const posD = currentText.indexOf('ঘ.');

    if (posA !== -1) {
      parts.stimulus = currentText.substring(0, posA).trim();
      if (posB !== -1) {
        parts.qA = currentText.substring(posA + 2, posB).trim();
        if (posC !== -1) {
          parts.qB = currentText.substring(posB + 2, posC).trim();
          if (posD !== -1) {
            parts.qC = currentText.substring(posC + 2, posD).trim();
            parts.qD = currentText.substring(posD + 2).trim();
          } else {
            parts.qC = currentText.substring(posC + 2).trim();
          }
        } else {
          parts.qB = currentText.substring(posB + 2).trim();
        }
      } else {
        parts.qA = currentText.substring(posA + 2).trim();
      }
    } else {
      parts.stimulus = currentText;
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
          marksA: meta.marksA, 
          marksB: meta.marksB, 
          marksC: meta.marksC, 
          marksD: meta.marksD
        };
      }
      return {
        type: 'short',
        shortText: q.content,
        shortMarks: q.shortMarks
      };
    });

    const docId = editId || doc(collection(db!, 'questions')).id;
    const questionSetData = {
      ...meta,
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
        toast({ title: "সফল!", description: "প্রশ্নপত্রটি ফায়ারবেসে সেভ করা হয়েছে।" });
        if (!editId) {
          router.replace(`/create-question?id=${docId}`);
        }
      })
      .catch(async () => {
        setSaving(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path, operation: 'write', requestResourceData: questionSetData
        }));
      });
  };

  const handlePrint = () => {
    window.print();
  };

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
              <p className="text-sm text-muted-foreground">ম্যানুয়ালি প্রশ্ন তৈরি ও প্রিন্ট করুন</p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => router.push('/my-questions')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> আমার প্রশ্নসমূহ
          </Button>
        </header>

        <Card className="shadow-md">
          <CardHeader className="bg-primary/5 border-b py-3">
            <CardTitle className="text-base flex items-center gap-2 font-bold">
              <BookOpen className="w-4 h-4 text-primary" /> পরীক্ষার সাধারণ তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label>
              <Input value={meta.institution || ''} onChange={e => setMeta({...meta, institution: e.target.value})} placeholder="উদা: বীরগঞ্জ সরকারি উচ্চ বিদ্যালয়" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">পরীক্ষার নাম</label>
              <Input value={meta.exam || ''} onChange={e => setMeta({...meta, exam: e.target.value})} placeholder="উদা: বার্ষিক পরীক্ষা" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">শ্রেণি</label>
              <Select onValueChange={v => setMeta({...meta, classId: v})} value={meta.classId || ''}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">বিষয়</label>
              <Select onValueChange={v => setMeta({...meta, subject: v})} value={meta.subject || ''} disabled={!meta.classId}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">সময়</label>
              <Input value={meta.time || ''} onChange={e => setMeta({...meta, time: e.target.value})} placeholder="উদা: ২ ঘণ্টা ৩০ মিনিট" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">পূর্ণমান</label>
              <Input value={meta.totalMarks || ''} onChange={e => setMeta({...meta, totalMarks: e.target.value})} placeholder="১০০" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-primary/20 bg-primary/5">
          <CardHeader className="py-2 border-b">
            <CardTitle className="text-xs font-bold uppercase text-primary">সৃজনশীল প্রশ্নের মান বণ্টন (একবার দিন)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex gap-4">
            {['ক', 'খ', 'গ', 'ঘ'].map((key, i) => (
              <div key={key} className="flex-1 space-y-1">
                <label className="text-xs font-bold">{key}. নম্বর</label>
                <Input type="number" className="h-8 text-center font-bold" 
                  value={i === 0 ? meta.marksA : i === 1 ? meta.marksB : i === 2 ? meta.marksC : meta.marksD} 
                  onChange={e => {
                    const v = Number(e.target.value);
                    if (i === 0) setMeta({...meta, marksA: v});
                    else if (i === 1) setMeta({...meta, marksB: v});
                    else if (i === 2) setMeta({...meta, marksC: v});
                    else setMeta({...meta, marksD: v});
                  }} 
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold">সৃজনশীল নির্দেশনা</label>
            <Input value={meta.creativeInstruction || ''} onChange={e => setMeta({...meta, creativeInstruction: e.target.value})} placeholder="যেকোনো ৭টি প্রশ্নের উত্তর দাও" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">সংক্ষিপ্ত নির্দেশনা</label>
            <Input value={meta.shortInstruction || ''} onChange={e => setMeta({...meta, shortInstruction: e.target.value})} placeholder="সকল প্রশ্নের উত্তর দাও" />
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
            <Card key={idx} className="relative border-l-4 border-l-primary">
              <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => handleRemoveQuestion(idx)}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                    {q.type === 'creative' ? 'সৃজনশীল' : 'সংক্ষিপ্ত'}
                  </span>
                  <span className="text-sm font-bold">প্রশ্ন নং: {idx + 1}</span>
                </div>
                {q.type === 'creative' ? (
                  <Textarea 
                    placeholder="উদ্দীপক ও প্রশ্ন একসাথে (ক. খ. গ. ঘ. সহ) লিখুন। উদা: উদ্দীপক... ক. প্রশ্ন খ. প্রশ্ন..." 
                    value={q.content || ''} 
                    onChange={e => updateQuestion(idx, {content: e.target.value})}
                    className="min-h-[150px] text-sm leading-relaxed"
                  />
                ) : (
                  <div className="flex gap-4">
                    <Input className="flex-1" value={q.content || ''} onChange={e => updateQuestion(idx, {content: e.target.value})} placeholder="সংক্ষিপ্ত প্রশ্ন লিখুন..." />
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold">মান:</label>
                      <Input type="number" className="w-16 h-8 text-center" value={q.shortMarks || 2} onChange={e => updateQuestion(idx, {shortMarks: Number(e.target.value)})} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {questions.length > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex gap-4 z-40 bg-background/90 backdrop-blur p-4 rounded-full border shadow-2xl">
            <Button onClick={handleSaveToDb} disabled={saving} variant="outline" className="gap-2 px-8 border-primary text-primary rounded-full font-bold">
              <Save className="w-4 h-4" /> {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
            <Button onClick={handlePrint} size="lg" className="bg-primary hover:bg-primary/90 gap-2 px-10 shadow-lg font-bold rounded-full text-white">
              <Printer className="w-4 h-4" /> প্রিন্ট / পিডিএফ
            </Button>
          </div>
        )}
      </div>

      <div className="print-only">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { size: A4; margin: 0.5in; }
            body { 
              font-family: 'Inter', sans-serif; 
              font-size: 9pt; 
              color: black !important; 
              line-height: 1.1 !important; 
              background: white !important; 
            }
            .paper { width: 100%; text-align: justify; }
            .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid black; padding-bottom: 5px; }
            .inst-name { font-size: 14pt; font-weight: 800; margin-bottom: 2px; }
            .exam-name { font-size: 11pt; font-weight: 700; margin-bottom: 2px; }
            .meta-info { display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px; font-size: 9pt; }
            .section-label-container { text-align: center; width: 100%; margin-top: 15px; margin-bottom: 5px; }
            .section-label { font-size: 10pt; font-weight: bold; border-bottom: 1.5px solid black; display: inline-block; padding: 0 10px; }
            .instruction { font-style: italic; font-size: 8.5pt; margin-bottom: 8px; text-align: center; width: 100%; }
            .q-block { margin-bottom: 12px; page-break-inside: avoid; }
            .stimulus { margin-bottom: 4px; white-space: pre-wrap; line-height: 1.1; text-align: justify; }
            .sub-q { display: flex; justify-content: space-between; margin-bottom: 1px; align-items: flex-start; }
            .mark { font-weight: bold; width: 25px; text-align: right; min-width: 25px; }
            
            /* উন্নত গাণিতিক স্টাইল */
            sup, sub { line-height: 0; position: relative; vertical-align: baseline; font-size: 0.75em; }
            sup { top: -0.4em; }
            sub { bottom: -0.25em; }
            .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.85em; margin: 0 2px; }
            .math-frac sup { position: static; top: 0; }
            .math-frac sub { position: static; bottom: 0; border-top: 0.5px solid black; }
            .sqrt { position: relative; display: inline-block; vertical-align: middle; }
            .sqrt-stem { border-top: 0.8px solid black; padding-top: 1px; margin-left: 1px; display: inline-block; }
            
            .no-print { display: none !important; }
          }
        `}} />
        
        <div className="paper">
          <div className="header">
            <div className="inst-name">{meta.institution}</div>
            <div className="exam-name">{meta.exam}</div>
            <div className="font-bold">শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || ''} | বিষয়: {meta.subject}</div>
            <div className="meta-info">
              <div>সময়: {meta.time}</div>
              <div>পূর্ণমান: {meta.totalMarks}</div>
            </div>
          </div>

          {creativeQuestions.length > 0 && (
            <div className="section">
              <div className="section-label-container">
                <div className="section-label">সৃজনশীল প্রশ্ন</div>
              </div>
              <div className="instruction">{meta.creativeInstruction}</div>
              {creativeQuestions.map((q, idx) => {
                const parsed = parseCreative(q.content);
                return (
                  <div key={idx} className="q-block">
                    <div className="font-bold mb-1">{idx + 1}. নিচের উদ্দীপকটি পড়ো এবং প্রশ্নগুলোর উত্তর দাও:</div>
                    <div className="stimulus" dangerouslySetInnerHTML={{ __html: formatMath(parsed.stimulus) }} />
                    <div className="space-y-0">
                      {parsed.qA && (
                        <div className="sub-q">
                          <span dangerouslySetInnerHTML={{ __html: 'ক. ' + formatMath(parsed.qA) }} />
                          <span className="mark">{meta.marksA}</span>
                        </div>
                      )}
                      {parsed.qB && (
                        <div className="sub-q">
                          <span dangerouslySetInnerHTML={{ __html: 'খ. ' + formatMath(parsed.qB) }} />
                          <span className="mark">{meta.marksB}</span>
                        </div>
                      )}
                      {parsed.qC && (
                        <div className="sub-q">
                          <span dangerouslySetInnerHTML={{ __html: 'গ. ' + formatMath(parsed.qC) }} />
                          <span className="mark">{meta.marksC}</span>
                        </div>
                      )}
                      {parsed.qD && (
                        <div className="sub-q">
                          <span dangerouslySetInnerHTML={{ __html: 'ঘ. ' + formatMath(parsed.qD) }} />
                          <span className="mark">{meta.marksD}</span>
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
              <div className="section-label-container">
                <div className="section-label">সংক্ষিপ্ত প্রশ্ন</div>
              </div>
              <div className="instruction">{meta.shortInstruction}</div>
              {shortQuestions.map((q, idx) => (
                <div key={idx} className="q-block flex justify-between items-start">
                  <span dangerouslySetInnerHTML={{ __html: `${idx + 1}. ${formatMath(q.content)}` }} />
                  <span className="mark">{q.shortMarks}</span>
                </div>
              ))}
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
