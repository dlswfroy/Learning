
"use client";

import { useState, useTransition, useRef } from 'react';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { generatePracticeQuestions } from '@/ai/flows/generate-practice-questions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BrainCircuit, Printer, Plus, Trash2, FileDown, BookOpen, Clock, Award } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Question = {
  type: 'creative' | 'short';
  stimulus?: string;
  qA?: string;
  qB?: string;
  qC?: string;
  qD?: string;
  marksA?: number;
  marksB?: number;
  marksC?: number;
  marksD?: number;
  shortText?: string;
  shortMarks?: number;
};

export default function CreateQuestionPage() {
  const [isPending, startTransition] = useTransition();
  const printRef = useRef<HTMLDivElement>(null);

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
      ? { type, stimulus: '', qA: '', qB: '', qC: '', qD: '', marksA: 1, marksB: 2, marksC: 3, marksD: 4 }
      : { type, shortText: '', shortMarks: 5 };
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

  const handleAiGenerate = () => {
    if (!meta.classId || !meta.subject) {
      toast({ title: "তথ্য অসম্পূর্ণ", description: "শ্রেণি এবং বিষয় নির্বাচন করুন।", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      try {
        const cls = CLASSES.find(c => c.id === meta.classId);
        const output = await generatePracticeQuestions({
          classId: cls?.label || '',
          subject: meta.subject,
          type: 'mixed',
          count: 3
        });
        setQuestions([...questions, ...output.questions as Question[]]);
        toast({ title: "AI সফল!", description: "নতুন প্রশ্ন যুক্ত করা হয়েছে।" });
      } catch (e) {
        toast({ title: "ত্রুটি", description: "AI প্রশ্ন তৈরি করতে ব্যর্থ হয়েছে।", variant: "destructive" });
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 no-print">
      <header className="flex items-center gap-4 border-b pb-4">
        <div className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm">
          <BrainCircuit className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">প্রফেশনাল প্রশ্নপত্র নির্মাতা</h2>
          <p className="text-sm text-muted-foreground">বোর্ড স্ট্যান্ডার্ড সৃজনশীল ও সংক্ষিপ্ত প্রশ্নপত্র তৈরি করুন</p>
        </div>
      </header>

      {/* Form Metadata */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> পরীক্ষা সংক্রান্ত তথ্য
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label>
            <Input 
              placeholder="উদা: বীরগঞ্জ সরকারি উচ্চ বিদ্যালয়" 
              value={meta.institution} 
              onChange={e => setMeta({...meta, institution: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">পরীক্ষার নাম</label>
            <Input 
              placeholder="উদা: বার্ষিক পরীক্ষা - ২০২৪" 
              value={meta.exam} 
              onChange={e => setMeta({...meta, exam: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">শ্রেণি</label>
            <Select onValueChange={v => setMeta({...meta, classId: v})} value={meta.classId}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">বিষয়</label>
            <Select onValueChange={v => setMeta({...meta, subject: v})} value={meta.subject} disabled={!meta.classId}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> সময়</label>
            <Input value={meta.time} onChange={e => setMeta({...meta, time: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1"><Award className="w-3 h-3" /> পূর্ণমান</label>
            <Input value={meta.totalMarks} onChange={e => setMeta({...meta, totalMarks: e.target.value})} />
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-primary">প্রশ্নসমূহ ({questions.length})</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleAddQuestion('creative')} className="gap-1">
              <Plus className="w-4 h-4" /> সৃজনশীল
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAddQuestion('short')} className="gap-1">
              <Plus className="w-4 h-4" /> সংক্ষিপ্ত
            </Button>
            <Button onClick={handleAiGenerate} disabled={isPending} className="bg-accent hover:bg-accent/90 gap-1 text-xs">
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
              AI দিয়ে তৈরি
            </Button>
          </div>
        </div>

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
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">উদ্দীপক</label>
                    <Textarea 
                      placeholder="উদ্দীপকটি এখানে লিখুন..." 
                      value={q.stimulus} 
                      onChange={e => updateQuestion(idx, {stimulus: e.target.value})}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex gap-2 items-start">
                      <span className="font-bold pt-2">ক.</span>
                      <Input placeholder="প্রশ্ন..." value={q.qA} onChange={e => updateQuestion(idx, {qA: e.target.value})} />
                      <Input type="number" className="w-16" value={q.marksA} onChange={e => updateQuestion(idx, {marksA: Number(e.target.value)})} />
                    </div>
                    <div className="flex gap-2 items-start">
                      <span className="font-bold pt-2">খ.</span>
                      <Input placeholder="প্রশ্ন..." value={q.qB} onChange={e => updateQuestion(idx, {qB: e.target.value})} />
                      <Input type="number" className="w-16" value={q.marksB} onChange={e => updateQuestion(idx, {marksB: Number(e.target.value)})} />
                    </div>
                    <div className="flex gap-2 items-start">
                      <span className="font-bold pt-2">গ.</span>
                      <Input placeholder="প্রশ্ন..." value={q.qC} onChange={e => updateQuestion(idx, {qC: e.target.value})} />
                      <Input type="number" className="w-16" value={q.marksC} onChange={e => updateQuestion(idx, {marksC: Number(e.target.value)})} />
                    </div>
                    <div className="flex gap-2 items-start">
                      <span className="font-bold pt-2">ঘ.</span>
                      <Input placeholder="প্রশ্ন..." value={q.qD} onChange={e => updateQuestion(idx, {qD: e.target.value})} />
                      <Input type="number" className="w-16" value={q.marksD} onChange={e => updateQuestion(idx, {marksD: Number(e.target.value)})} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">সংক্ষিপ্ত প্রশ্ন</label>
                    <Input value={q.shortText} onChange={e => updateQuestion(idx, {shortText: e.target.value})} />
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">নম্বর</label>
                    <Input type="number" value={q.shortMarks} onChange={e => updateQuestion(idx, {shortMarks: Number(e.target.value)})} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {questions.length > 0 && (
        <div className="flex justify-center pt-8">
          <Button onClick={handlePrint} size="lg" className="bg-primary hover:bg-primary/90 gap-2 px-10 shadow-lg font-bold">
            <Printer className="w-5 h-5" /> প্রশ্নপত্র ডাউনলোড/প্রিন্ট
          </Button>
        </div>
      )}

      {/* Hidden Print Layout */}
      <div className="print-only" id="question-print-area">
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
            }
            .paper {
              text-align: justify;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .institution {
              font-size: 14pt;
              font-weight: bold;
              text-transform: uppercase;
            }
            .exam-name {
              font-size: 11pt;
              font-weight: bold;
            }
            .meta-grid {
              display: flex;
              justify-content: space-between;
              border-bottom: 1px solid black;
              padding-bottom: 5px;
              margin-bottom: 15px;
              font-weight: bold;
            }
            .question-item {
              margin-bottom: 20px;
            }
            .stimulus {
              margin-bottom: 8px;
              font-style: italic;
            }
            .sub-q {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            }
            .marks {
              font-weight: bold;
              min-width: 20px;
              text-align: right;
            }
          }
          .print-only { display: none; }
        `}} />
        
        <div className="paper">
          <div className="header">
            <div className="institution">{meta.institution || 'শিক্ষা প্রতিষ্ঠানের নাম'}</div>
            <div className="exam-name">{meta.exam || 'পরীক্ষার নাম'}</div>
            <div>শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || '...'} | বিষয়: {meta.subject || '...'}</div>
          </div>
          
          <div className="meta-grid">
            <div>সময়: {meta.time}</div>
            <div>পূর্ণমান: {meta.totalMarks}</div>
          </div>

          <div className="content">
            {questions.map((q, idx) => (
              <div key={idx} className="question-item">
                {q.type === 'creative' ? (
                  <>
                    <div className="font-bold mb-1">{idx + 1}. নিচের উদ্দীপকটি পড়ো এবং প্রশ্নগুলোর উত্তর দাও:</div>
                    <div className="stimulus">{q.stimulus}</div>
                    <div className="sub-q">
                      <span>ক. {q.qA}</span>
                      <span className="marks">{q.marksA}</span>
                    </div>
                    <div className="sub-q">
                      <span>খ. {q.qB}</span>
                      <span className="marks">{q.marksB}</span>
                    </div>
                    <div className="sub-q">
                      <span>গ. {q.qC}</span>
                      <span className="marks">{q.marksC}</span>
                    </div>
                    <div className="sub-q">
                      <span>ঘ. {q.qD}</span>
                      <span className="marks">{q.marksD}</span>
                    </div>
                  </>
                ) : (
                  <div className="sub-q font-bold">
                    <span>{idx + 1}. {q.shortText}</span>
                    <span className="marks">{q.shortMarks}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
