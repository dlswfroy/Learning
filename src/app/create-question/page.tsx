"use client";

import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { generatePracticeQuestions, type GeneratePracticeQuestionsOutput } from '@/ai/flows/generate-practice-questions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BrainCircuit, CheckCircle2, Copy, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function CreateQuestionPage() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<GeneratePracticeQuestionsOutput | null>(null);

  const [classId, setClassId] = useState(searchParams.get('classId') || '');
  const [subject, setSubject] = useState(searchParams.get('subject') || '');

  const subjects = classId ? getSubjectsForClass(classId) : [];

  const handleGenerate = () => {
    if (!classId || !subject) {
      toast({
        title: "তথ্য অসম্পূর্ণ",
        description: "অনুগ্রহ করে শ্রেণি এবং বিষয় নির্বাচন করুন।",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const selectedClass = CLASSES.find(c => c.id === classId);
        const output = await generatePracticeQuestions({
          classId: selectedClass?.value || 'general',
          subject: subject,
          numberOfQuestions: 5,
        });
        setResult(output);
        toast({
          title: "সফল হয়েছে!",
          description: "আপনার জন্য প্রশ্নপত্র তৈরি করা হয়েছে।",
        });
      } catch (error) {
        toast({
          title: "ত্রুটি",
          description: "প্রশ্ন তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
          variant: "destructive",
        });
      }
    });
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = result.questions.map((q, i) => `প্রশ্ন ${i + 1}: ${q.question}\nউত্তর: ${q.answer}`).join('\n\n');
    navigator.clipboard.writeText(text);
    toast({ title: "কপি হয়েছে", description: "প্রশ্নপত্র ক্লিপবোর্ডে কপি করা হয়েছে।" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <header className="flex items-center gap-4 border-b pb-4">
        <div className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm">
          <BrainCircuit className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">AI প্রশ্ন তৈরি করুন</h2>
          <p className="text-sm text-muted-foreground">আপনার পছন্দের বিষয়ের ওপর তাৎক্ষণিক প্রশ্ন তৈরি করুন</p>
        </div>
      </header>

      <Card className="shadow-md">
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">শ্রেণি নির্বাচন করুন</label>
            <Select onValueChange={setClassId} value={classId}>
              <SelectTrigger>
                <SelectValue placeholder="শ্রেণি পছন্দ করুন" />
              </SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">বিষয় নির্বাচন করুন</label>
            <Select onValueChange={setSubject} value={subject} disabled={!classId}>
              <SelectTrigger>
                <SelectValue placeholder="বিষয় পছন্দ করুন" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t py-6">
          <Button 
            onClick={handleGenerate} 
            disabled={isPending}
            className="w-full sm:w-64 gap-2 bg-primary hover:bg-primary/90"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BrainCircuit className="w-4 h-4" />
            )}
            {isPending ? 'তৈরি করা হচ্ছে...' : 'প্রশ্ন তৈরি করুন'}
          </Button>
        </CardFooter>
      </Card>

      {result && (
        <div className="space-y-6 animate-fade-in pb-12">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              প্রস্তুতকৃত প্রশ্নসমূহ
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={copyToClipboard}>
                <Copy className="w-4 h-4" /> কপি
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleGenerate}>
                <RefreshCw className="w-4 h-4" /> পুনরায় তৈরি
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {result.questions.map((q, idx) => (
              <Card key={idx} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="p-4 pb-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">প্রশ্ন {idx + 1}</span>
                  <CardTitle className="text-lg leading-relaxed">{q.question}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="bg-secondary/50 p-3 rounded-lg mt-2">
                    <p className="text-sm font-medium text-muted-foreground mb-1 italic">সঠিক উত্তর:</p>
                    <p className="text-foreground font-semibold">{q.answer}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}