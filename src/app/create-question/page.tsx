"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Plus, Trash2, BookOpen, Clock, Award, Save, FileText, ListChecks, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type Question = {
  type: 'creative' | 'short';
  content: string; 
  shortMarks?: number;
};

function CreateQuestionContent() {
  const db = useFirestore();
  const { user } = useUser();
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
  });

  const [questions, setQuestions] = useState<Question[]>([]);

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
            time: data.time || '২ ঘণ্টা ৩০ মিনিট',
            totalMarks: data.totalMarks || '১০০',
            marksA: data.marksA || 1,
            marksB: data.marksB || 2,
            marksC: data.marksC || 3,
            marksD: data.marksD || 4,
          });
          
          // Reconstruct UI format from storage format
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
        } else {
          toast({ title: "পাওয়া যায়নি", description: "প্রশ্নপত্রটি খুঁজে পাওয়া যায়নি।", variant: "destructive" });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadQuestion();
  }, [editId, db]);

  const subjects = meta.classId ? getSubjectsForClass(meta.classId) : [];

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
    const posA = text.indexOf('ক.');
    const posB = text.indexOf('খ.');
    const posC = text.indexOf('গ.');
    const posD = text.indexOf('ঘ.');

    if (posA !== -1) {
      parts.stimulus = text.substring(0, posA).trim();
      if (posB !== -1) {
        parts.qA = text.substring(posA + 2, posB).trim();
        if (posC !== -1) {
          parts.qB = text.substring(posB + 2, posC).trim();
          if (posD !== -1) {
            parts.qC = text.substring(posC + 2, posD).trim();
            parts.qD = text.substring(posD + 2).trim();
          } else {
            parts.qC = text.substring(posC + 2).trim();
          }
        } else {
          parts.qB = text.substring(posB + 2).trim();
        }
      } else {
        parts.qA = text.substring(posA + 2).trim();
      }
    } else {
      parts.stimulus = text;
    }
    return parts;
  };

  const handleSaveToDb = async () => {
    if (!user) {
      toast({ title: "লগইন প্রয়োজন", description: "প্রশ্নপত্র সেভ করতে অনুগ্রহ করে লগইন করুন।", variant: "destructive" });
      return;
    }
    if (!meta.classId || !meta.subject || questions.length === 0) {
      toast({ title: "তথ্য অসম্পূর্ণ", description: "শ্রেণি, বিষয় এবং অন্তত একটি প্রশ্ন যোগ করুন।", variant: "destructive" });
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

    const questionSetData = {
      ...meta,
      questions: formattedQuestions,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };

    const operation = editId ? updateDoc(doc(db!, 'questions', editId), questionSetData) : addDoc(collection(db!, 'questions'), { ...questionSetData, createdAt: serverTimestamp() });

    operation
      .then(() => {
        toast({ title: "সফল!", description: editId ? "প্রশ্নপত্রটি আপডেট করা হয়েছে।" : "প্রশ্নপত্রটি সেভ করা হয়েছে।" });
        router.push('/my-questions');
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: editId ? `questions/${editId}` : 'questions',
          operation: editId ? 'update' : 'create',
          requestResourceData: questionSetData
        }));
      })
      .finally(() => setSaving(false));
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">প্রশ্নপত্র লোড হচ্ছে...</p>
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
              <h2 className="text-2xl font-bold text-primary">{editId ? 'প্রশ্ন এডিট করুন' : 'প্রশ্নপত্র নির্মাতা'}</h2>
              <p className="text-sm text-muted-foreground">বোর্ড ফরম্যাটে প্রশ্নপত্র তৈরি ও প্রিন্ট করুন</p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> ফিরে যান
          </Button>
        </header>

        {/* Form Metadata */}
        <Card className="shadow-md border-primary/10">
          <CardHeader className="bg-primary/5 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> পরীক্ষার সাধারণ তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label>
              <Input 
                placeholder="উদা: বীরগঞ্জ সরকারি উচ্চ বিদ্যালয়" 
                value={meta.institution || ''} 
                onChange={e => setMeta({...meta, institution: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">পরীক্ষার নাম</label>
              <Input 
                placeholder="উদা: বার্ষিক পরীক্ষা - ২০২৪" 
                value={meta.exam || ''} 
                onChange={e => setMeta({...meta, exam: e.target.value})}
              />
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
              <label className="text-sm font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> সময়</label>
              <Input value={meta.time || ''} onChange={e => setMeta({...meta, time: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-1"><Award className="w-3 h-3" /> পূর্ণমান</label>
              <Input value={meta.totalMarks || ''} onChange={e => setMeta({...meta, totalMarks: e.target.value})} />
            </div>
          </CardContent>
        </Card>

        {/* Global Marks Config */}
        <Card className="shadow-sm border-accent/20">
          <CardHeader className="py-3 bg-accent/5 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-accent" /> সৃজনশীল প্রশ্নের মান বণ্টন
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">ক.</label>
              <Input type="number" value={meta.marksA} onChange={e => setMeta({...meta, marksA: Number(e.target.value)})} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">খ.</label>
              <Input type="number" value={meta.marksB} onChange={e => setMeta({...meta, marksB: Number(e.target.value)})} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">গ.</label>
              <Input type="number" value={meta.marksC} onChange={e => setMeta({...meta, marksC: Number(e.target.value)})} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">ঘ.</label>
              <Input type="number" value={meta.marksD} onChange={e => setMeta({...meta, marksD: Number(e.target.value)})} />
            </div>
          </CardContent>
        </Card>

        {/* Questions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-primary">প্রশ্নসমূহ ({questions.length})</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('creative')} className="gap-1 border-primary text-primary hover:bg-primary/10">
                <Plus className="w-4 h-4" /> সৃজনশীল যোগ
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddQuestion('short')} className="gap-1 border-accent text-accent hover:bg-accent/10">
                <Plus className="w-4 h-4" /> সংক্ষিপ্ত যোগ
              </Button>
            </div>
          </div>

          {questions.map((q, idx) => (
            <Card key={idx} className="relative group border-l-4 border-l-primary hover:shadow-md transition-all">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 text-destructive opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveQuestion(idx)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase">
                    {q.type === 'creative' ? 'সৃজনশীল' : 'সংক্ষিপ্ত'}
                  </span>
                  <span className="text-sm font-bold">প্রশ্ন নং: {idx + 1}</span>
                </div>

                {q.type === 'creative' ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground">উদ্দীপক ও প্রশ্ন (ক. খ. গ. ঘ. সহ একসাথে লিখুন)</label>
                    <Textarea 
                      placeholder="উদ্দীপক লিখুন... তারপর ক. খ. গ. ঘ. দিয়ে প্রশ্নগুলো লিখুন।" 
                      value={q.content || ''} 
                      onChange={e => updateQuestion(idx, {content: e.target.value})}
                      className="min-h-[150px]"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">সংক্ষিপ্ত প্রশ্ন</label>
                      <Input 
                        placeholder="প্রশ্নটি এখানে লিখুন..."
                        value={q.content || ''} 
                        onChange={e => updateQuestion(idx, {content: e.target.value})} 
                      />
                    </div>
                    <div className="w-full md:w-32 space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">নম্বর</label>
                      <Input type="number" value={q.shortMarks || 2} onChange={e => updateQuestion(idx, {shortMarks: Number(e.target.value)})} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {questions.length > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex gap-4 z-40 bg-background/90 backdrop-blur p-4 rounded-full border shadow-2xl">
            <Button onClick={handleSaveToDb} disabled={saving} variant="outline" className="gap-2 px-8 border-primary text-primary hover:bg-primary/5 rounded-full">
              <Save className="w-4 h-4" /> {saving ? 'সেভ হচ্ছে...' : (editId ? 'আপডেট করুন' : 'সেভ করুন')}
            </Button>
            <Button onClick={handlePrint} size="lg" className="bg-primary hover:bg-primary/90 gap-2 px-10 shadow-lg font-bold rounded-full">
              <Printer className="w-4 h-4" /> প্রিন্ট / পিডিএফ
            </Button>
          </div>
        )}
      </div>

      {/* Hidden Print Layout - This is what gets printed */}
      <div className="print-only" id="printable-area">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            #printable-area {
              display: block !important;
              font-family: 'Inter', 'Arial', sans-serif !important;
              font-size: 9pt !important;
              color: black !important;
              line-height: 1.5 !important;
              padding: 0.5in !important;
              background: white !important;
            }
            .paper { width: 100%; text-align: justify; }
            .header-center { text-align: center; margin-bottom: 20px; }
            .inst { font-size: 14pt; font-weight: bold; margin-bottom: 2px; }
            .exam { font-size: 11pt; font-weight: bold; margin-bottom: 2px; }
            .meta { display: flex; justify-content: space-between; border-bottom: 1.5px solid black; padding-bottom: 4px; margin-bottom: 20px; font-weight: bold; }
            .q-block { margin-bottom: 25px; page-break-inside: avoid; }
            .stimulus { margin-bottom: 10px; white-space: pre-wrap; text-align: justify; }
            .sub-q { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .mark { font-weight: bold; min-width: 25px; text-align: right; }
          }
        `}} />
        
        <div className="paper">
          <div className="header-center">
            <div className="inst">{meta.institution || 'শিক্ষা প্রতিষ্ঠানের নাম'}</div>
            <div className="exam">{meta.exam || 'পরীক্ষার নাম'}</div>
            <div className="font-bold">
              শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || '...'} | বিষয়: {meta.subject || '...'}
            </div>
          </div>
          
          <div className="meta">
            <div>সময়: {meta.time}</div>
            <div>পূর্ণমান: {meta.totalMarks}</div>
          </div>

          <div className="questions">
            {questions.map((q, idx) => {
              if (q.type === 'creative') {
                const parsed = parseCreative(q.content);
                return (
                  <div key={idx} className="q-block">
                    <div className="font-bold mb-1">{idx + 1}. নিচের উদ্দীপকটি পড়ো এবং প্রশ্নগুলোর উত্তর দাও:</div>
                    <div className="stimulus">{parsed.stimulus}</div>
                    <div className="space-y-1">
                      {parsed.qA && <div className="sub-q"><span>ক. {parsed.qA}</span><span className="mark">{meta.marksA}</span></div>}
                      {parsed.qB && <div className="sub-q"><span>খ. {parsed.qB}</span><span className="mark">{meta.marksB}</span></div>}
                      {parsed.qC && <div className="sub-q"><span>গ. {parsed.qC}</span><span className="mark">{meta.marksC}</span></div>}
                      {parsed.qD && <div className="sub-q"><span>ঘ. {parsed.qD}</span><span className="mark">{meta.marksD}</span></div>}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={idx} className="q-block flex justify-between">
                    <div className="flex-1">{idx + 1}. {q.content}</div>
                    <span className="mark">{q.shortMarks}</span>
                  </div>
                );
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateQuestionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateQuestionContent />
    </Suspense>
  );
}