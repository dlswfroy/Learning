
"use client";

import { useState } from 'react';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Plus, Trash2, BookOpen, Clock, Award, Save, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type Question = {
  type: 'creative' | 'short';
  content: string; // One box for everything
  shortMarks?: number;
};

export default function CreateQuestionPage() {
  const db = useFirestore();
  const { user } = useUser();
  const [saving, setSaving] = useState(false);

  const [meta, setMeta] = useState({
    institution: '',
    exam: '',
    classId: '',
    subject: '',
    time: '২ ঘণ্টা ৩০ মিনিট',
    totalMarks: '১০০',
  });

  const [questions, setQuestions] = useState<Question[]>([]);

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
    // Basic logic to split stimulus and parts based on markers ক. খ. গ. ঘ.
    const parts = {
      stimulus: '',
      qA: '',
      qB: '',
      qC: '',
      qD: ''
    };

    const markers = ['ক.', 'খ.', 'গ.', 'ঘ.'];
    let lastIndex = 0;
    let currentMarker = '';

    // Simple parser: Find marker positions
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
    // Transform data for firestore to match backend.json schema if possible
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
          marksA: 1, marksB: 2, marksC: 3, marksD: 4
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
      createdAt: serverTimestamp(),
    };

    addDoc(collection(db, 'questions'), questionSetData)
      .then(() => {
        toast({ title: "সফল!", description: "প্রশ্নপত্রটি ডাটাবেসে সেভ করা হয়েছে।" });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'questions',
          operation: 'create',
          requestResourceData: questionSetData
        }));
      })
      .finally(() => setSaving(false));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 no-print">
      <header className="flex items-center gap-4 border-b pb-4">
        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
          <FileText className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">ম্যানুয়াল প্রশ্নপত্র নির্মাতা</h2>
          <p className="text-sm text-muted-foreground">উদ্দীপক ও প্রশ্ন এক বক্সে লিখে বোর্ড স্ট্যান্ডার্ড প্রশ্নপত্র তৈরি করুন</p>
        </div>
      </header>

      {/* Form Metadata */}
      <Card className="shadow-md border-primary/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> পরীক্ষার সাধারণ তথ্য
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Questions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-primary">প্রশ্নসমূহ ({questions.length})</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleAddQuestion('creative')} className="gap-1 border-primary text-primary hover:bg-primary/10">
              <Plus className="w-4 h-4" /> সৃজনশীল যোগ করুন
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAddQuestion('short')} className="gap-1 border-accent text-accent hover:bg-accent/10">
              <Plus className="w-4 h-4" /> সংক্ষিপ্ত যোগ করুন
            </Button>
          </div>
        </div>

        {questions.length === 0 && (
          <div className="text-center p-12 bg-muted/20 border-2 border-dashed rounded-xl">
            <p className="text-muted-foreground">এখনো কোনো প্রশ্ন যোগ করা হয়নি। উপরের বাটন থেকে প্রশ্ন যোগ করুন।</p>
          </div>
        )}

        {questions.map((q, idx) => (
          <Card key={idx} className="relative group border-l-4 border-l-primary hover:shadow-md transition-all">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
                    className="min-h-[180px]"
                  />
                  <p className="text-[10px] text-muted-foreground">টিপস: "ক.", "খ.", "গ.", "ঘ." ব্যবহার করলে সিস্টেম অটোমেটিক নম্বর ও প্রশ্ন আলাদা করে দেবে।</p>
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
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
          <Button onClick={handleSaveToDb} disabled={saving} variant="outline" className="gap-2 px-8 border-primary text-primary hover:bg-primary/5">
            <Save className="w-5 h-5" /> {saving ? 'সেভ হচ্ছে...' : 'ডাটাবেসে সেভ করুন'}
          </Button>
          <Button onClick={handlePrint} size="lg" className="bg-primary hover:bg-primary/90 gap-2 px-10 shadow-lg font-bold">
            <Printer className="w-5 h-5" /> প্রিন্ট / পিডিএফ ডাউনলোড
          </Button>
        </div>
      )}

      {/* Hidden Print Layout */}
      <div className="print-only">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            @page {
              size: A4;
              margin: 0.5in;
            }
            body {
              font-family: 'Inter', 'Arial', sans-serif;
              font-size: 9pt;
              color: black;
              background: white;
              padding: 0;
              margin: 0;
            }
            .paper {
              width: 100%;
              text-align: justify;
              line-height: 1.5;
            }
            .header-section {
              text-align: center;
              margin-bottom: 25px;
            }
            .inst-name {
              font-size: 14pt;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .exam-title {
              font-size: 11pt;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .subject-meta {
              font-size: 10pt;
              font-weight: bold;
            }
            .meta-line {
              display: flex;
              justify-content: space-between;
              border-bottom: 1px solid black;
              padding-bottom: 4px;
              margin-bottom: 15px;
              font-weight: bold;
              font-size: 9.5pt;
            }
            .q-block {
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            .q-title {
              font-weight: bold;
              margin-bottom: 8px;
            }
            .stimulus-text {
              margin-bottom: 12px;
              white-space: pre-wrap;
              text-align: justify;
            }
            .sub-questions {
              display: grid;
              gap: 4px;
            }
            .sub-q-row {
              display: grid;
              grid-template-columns: 1fr 20px;
              gap: 10px;
              align-items: flex-start;
            }
            .q-mark {
              text-align: right;
              font-weight: bold;
            }
            .short-q-block {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              margin-bottom: 10px;
            }
          }
          .print-only { display: none; }
        `}} />
        
        <div className="paper">
          <div className="header-section">
            <div className="inst-name">{meta.institution || 'শিক্ষা প্রতিষ্ঠানের নাম'}</div>
            <div className="exam-title">{meta.exam || 'পরীক্ষার নাম'}</div>
            <div className="subject-meta">
              শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || '...'} | বিষয়: {meta.subject || '...'}
            </div>
          </div>
          
          <div className="meta-line">
            <div>সময়: {meta.time}</div>
            <div>পূর্ণমান: {meta.totalMarks}</div>
          </div>

          <div className="questions-container">
            {questions.map((q, idx) => {
              if (q.type === 'creative') {
                const parsed = parseCreative(q.content);
                return (
                  <div key={idx} className="q-block">
                    <div className="q-title">{idx + 1}. নিচের উদ্দীপকটি পড়ো এবং প্রশ্নগুলোর উত্তর দাও:</div>
                    <div className="stimulus-text">{parsed.stimulus}</div>
                    <div className="sub-questions">
                      {parsed.qA && (
                        <div className="sub-q-row">
                          <span>ক. {parsed.qA}</span>
                          <span className="q-mark">১</span>
                        </div>
                      )}
                      {parsed.qB && (
                        <div className="sub-q-row">
                          <span>খ. {parsed.qB}</span>
                          <span className="q-mark">২</span>
                        </div>
                      )}
                      {parsed.qC && (
                        <div className="sub-q-row">
                          <span>গ. {parsed.qC}</span>
                          <span className="q-mark">৩</span>
                        </div>
                      )}
                      {parsed.qD && (
                        <div className="sub-q-row">
                          <span>ঘ. {parsed.qD}</span>
                          <span className="q-mark">৪</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={idx} className="short-q-block">
                    <span>{idx + 1}. {q.content}</span>
                    <span className="q-mark">{q.shortMarks}</span>
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
