
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Calendar, 
  Loader2, 
  ArrowLeft, 
  FileText, 
  Printer,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  Phone
} from 'lucide-react';
import { CLASSES, getSubjectsForClass, getChaptersForSubject, HIGHER_SUBJECTS } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MONTHS_BN = [
  { id: '01', name: 'জানুয়ারি' },
  { id: '02', name: 'ফেব্রুয়ারি' },
  { id: '03', name: 'মার্চ' },
  { id: '04', name: 'এপ্রিল' },
  { id: '05', name: 'মে' },
  { id: '06', name: 'জুন' },
  { id: '07', name: 'জুলাই' },
  { id: '08', name: 'আগস্ট' },
  { id: '09', name: 'সেপ্টেম্বর' },
  { id: '10', name: 'অক্টোবর' },
  { id: '11', name: 'নভেম্বর' },
  { id: '12', name: 'ডিসেম্বর' },
];

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

export default function TeacherDiaryPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'MM'));
  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    classId: '',
    subject: '',
    topic: '',
    notes: ''
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) window.location.href = '/auth';
  }, [user, userLoading]);

  const diaryQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'diary'), 
      where('userId', '==', user.uid),
      orderBy('date', 'asc')
    );
  }, [db, user]);

  const { data: diaryEntries, loading: diaryLoading, error: diaryError } = useCollection(diaryQuery);

  const filteredEntries = useMemo(() => {
    if (!diaryEntries) return [];
    return diaryEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      const m = format(entryDate, 'MM');
      const y = format(entryDate, 'yyyy');
      
      const matchMonth = m === selectedMonth && y === selectedYear;
      const matchClass = filterClass === 'all' || entry.classId === filterClass;
      const matchSubject = filterSubject === 'all' || entry.subject === filterSubject;
      
      return matchMonth && matchClass && matchSubject;
    });
  }, [diaryEntries, selectedMonth, selectedYear, filterClass, filterSubject]);

  const subjectsList = useMemo(() => formData.classId ? getSubjectsForClass(formData.classId) : [], [formData.classId]);
  const chaptersList = useMemo(() => (formData.classId && formData.subject) ? getChaptersForSubject(formData.classId, formData.subject) : [], [formData.classId, formData.subject]);

  const allPossibleSubjects = useMemo(() => {
    if (filterClass === 'all') return HIGHER_SUBJECTS;
    return getSubjectsForClass(filterClass);
  }, [filterClass]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    if (!formData.date || !formData.classId || !formData.subject) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "শ্রেণি, বিষয় ও তারিখ নিশ্চিত করুন।" });
      return;
    }

    setIsSaving(true);
    const payload = {
      ...formData,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'diary', editingId), payload);
        toast({ title: "সফল", description: "ডায়েরি আপডেট করা হয়েছে।" });
      } else {
        await addDoc(collection(db, 'diary'), { ...payload, createdAt: serverTimestamp() });
        toast({ title: "সফল", description: "নতুন ডায়েরি যুক্ত করা হয়েছে।" });
      }
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        classId: '',
        subject: '',
        topic: '',
        notes: ''
      });
      setIsAdding(false);
      setEditingId(null);
    } catch (error) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "সেভ করা সম্ভব হয়নি।" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (entry: any) => {
    setFormData({
      date: entry.date,
      classId: entry.classId || '',
      subject: entry.subject || '',
      topic: entry.topic || '',
      notes: entry.notes || ''
    });
    setEditingId(entry.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm("আপনি কি নিশ্চিত?")) return;
    try {
      await deleteDoc(doc(db, 'diary', id));
      toast({ title: "সফল", description: "ডায়েরি মুছে ফেলা হয়েছে।" });
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "মুছে ফেলা সম্ভব হয়নি।" });
    }
  };

  if (userLoading || diaryLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-bold font-kalpurush">ডায়েরি লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20 font-kalpurush">
      <header className="flex items-center justify-between border-b pb-6 no-print">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">ডিজিটাল টিচার্স ডায়েরি</h2>
            <p className="text-xs text-muted-foreground font-bold">আপনার প্রতিদিনের ক্লাস রেকর্ড সংরক্ষণ করুন</p>
          </div>
        </div>
        <Button 
          onClick={() => { setIsAdding(!isAdding); setEditingId(null); if(!isAdding) setFormData({ date: format(new Date(), 'yyyy-MM-dd'), classId: '', subject: '', topic: '', notes: '' }); }}
          className={cn("gap-2 font-bold", isAdding ? "bg-muted text-muted-foreground" : "bg-indigo-600 hover:bg-indigo-700")}
        >
          {isAdding ? <ArrowLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? "ফিরে যান" : "নতুন রেকর্ড"}
        </Button>
      </header>

      {isAdding ? (
        <Card className="shadow-2xl border-2 border-black overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 no-print">
          <CardHeader className="bg-indigo-600 text-white py-4 border-b-2 border-black">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <FileText className="w-5 h-5" /> {editingId ? "ডায়েরি আপডেট করুন" : "নতুন ডায়েরি এন্ট্রি"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 border-b-2 border-black">
                <div className="p-4 border-r-0 md:border-r-2 border-b-2 md:border-b-0 border-black bg-slate-50">
                  <label className="block text-xs font-black text-indigo-700 uppercase mb-2 tracking-wider">শ্রেণির ড্রপডাউন</label>
                  <Select onValueChange={v => setFormData(p => ({...p, classId: v}))} value={formData.classId}>
                    <SelectTrigger className="font-bold h-12 border-2 border-black bg-white ring-offset-0 focus:ring-0">
                      <SelectValue placeholder="শ্রেণি নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black font-kalpurush">
                      {CLASSES.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.label} শ্রেণি</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 bg-slate-50">
                  <label className="block text-xs font-black text-indigo-700 uppercase mb-2 tracking-wider">বিষয়ের ড্রপ ডাউন</label>
                  <Select onValueChange={v => setFormData(p => ({...p, subject: v}))} value={formData.subject} disabled={!formData.classId}>
                    <SelectTrigger className="font-bold h-12 border-2 border-black bg-white ring-offset-0 focus:ring-0">
                      <SelectValue placeholder="বিষয় নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black font-kalpurush">
                      {subjectsList.map(s => <SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 min-h-[200px]">
                <div className="md:col-span-1 p-4 border-r-0 md:border-r-2 border-b-2 md:border-b-0 border-black bg-slate-50">
                  <label className="block text-xs font-black text-indigo-700 uppercase mb-2 tracking-wider">তারিখ</label>
                  <Input 
                    type="date" 
                    value={formData.date} 
                    onChange={e => setFormData(p => ({...p, date: e.target.value}))} 
                    className="font-bold h-12 border-2 border-black bg-white ring-offset-0 focus:ring-0"
                  />
                </div>
                <div className="md:col-span-3 p-4 bg-white">
                  <label className="block text-xs font-black text-indigo-700 uppercase mb-2 tracking-wider">প্রতিদিনের ক্লাস রেকর্ড</label>
                  <div className="space-y-3">
                    {chaptersList.length > 0 ? (
                      <Select onValueChange={v => setFormData(p => ({...p, topic: v}))} value={formData.topic}>
                        <SelectTrigger className="font-bold h-10 border-2 border-black bg-white ring-offset-0 focus:ring-0 mb-2">
                          <SelectValue placeholder="অধ্যায় / টপিক নির্বাচন করুন" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black font-kalpurush">
                          {chaptersList.map(ch => <SelectItem key={ch} value={ch} className="font-bold">{ch}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input 
                        value={formData.topic} 
                        onChange={e => setFormData(p => ({...p, topic: e.target.value}))} 
                        placeholder="টপিক বা শিরোনাম লিখুন..." 
                        className="font-bold h-10 border-2 border-black bg-white mb-2 ring-offset-0 focus:ring-0"
                      />
                    )}
                    <Textarea 
                      value={formData.notes} 
                      onChange={e => setFormData(p => ({...p, notes: e.target.value}))} 
                      placeholder="বিস্তারিত ক্লাস রেকর্ড বা আগামী দিনের পরিকল্পনা এখানে লিখুন..." 
                      className="min-h-[150px] font-bold text-base leading-relaxed border-2 border-black ring-offset-0 focus:ring-0"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-100 border-t-2 border-black flex justify-end">
                <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 h-12 px-10 text-lg font-black shadow-lg border-2 border-black text-white">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  সংরক্ষণ করুন
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end justify-between bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-200 no-print">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-700 uppercase ml-1">মাস</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-32 font-bold border-2 border-black bg-white h-11">
                    <SelectValue placeholder="মাস" />
                  </SelectTrigger>
                  <SelectContent className="font-kalpurush border-2 border-black">
                    {MONTHS_BN.map(m => <SelectItem key={m.id} value={m.id} className="font-bold">{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-700 uppercase ml-1">বছর</label>
                <Input 
                  value={selectedYear} 
                  onChange={e => setSelectedYear(e.target.value)} 
                  className="w-24 font-bold border-2 border-black h-11 text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-700 uppercase ml-1">শ্রেণি ফিল্টার</label>
                <Select value={filterClass} onValueChange={v => { setFilterClass(v); setFilterSubject('all'); }}>
                  <SelectTrigger className="w-32 font-bold border-2 border-black bg-white h-11">
                    <SelectValue placeholder="সব শ্রেণি" />
                  </SelectTrigger>
                  <SelectContent className="font-kalpurush border-2 border-black">
                    <SelectItem value="all" className="font-bold">সব শ্রেণি</SelectItem>
                    {CLASSES.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.label} শ্রেণি</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-700 uppercase ml-1">বিষয় ফিল্টার</label>
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger className="w-40 font-bold border-2 border-black bg-white h-11">
                    <SelectValue placeholder="সব বিষয়" />
                  </SelectTrigger>
                  <SelectContent className="font-kalpurush border-2 border-black">
                    <SelectItem value="all" className="font-bold">সব বিষয়</SelectItem>
                    {allPossibleSubjects.map(s => <SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={() => window.print()}
              variant="outline"
              className="gap-2 font-black border-2 border-black hover:bg-black hover:text-white transition-all h-11 px-6 shadow-md bg-white"
            >
              <Printer className="w-4 h-4" /> প্রিন্ট করুন
            </Button>
          </div>

          <div className="print-area">
            <div className="hidden print:block text-center space-y-2 mb-6">
              <h1 className="text-3xl font-black underline">মাসিক টিচার্স ডায়েরি রেকর্ড</h1>
              <p className="text-lg font-bold">
                মাস: {MONTHS_BN.find(m => m.id === selectedMonth)?.name} | বছর: {toBengaliNumber(selectedYear)}
                {filterClass !== 'all' && ` | শ্রেণি: ${CLASSES.find(c => c.id === filterClass)?.label} শ্রেণি`}
                {filterSubject !== 'all' && ` | বিষয়: ${filterSubject}`}
              </p>
            </div>

            {diaryError && (diaryError.code === 'failed-precondition' || diaryError.message.includes('index')) ? (
              <div className="text-center py-10 space-y-4 max-w-2xl mx-auto font-kalpurush border-2 border-dashed border-destructive rounded-2xl bg-destructive/5 p-6 no-print">
                <AlertTriangle className={cn("w-12 h-12 text-destructive mx-auto", diaryError.message.includes('building') ? "animate-pulse" : "animate-bounce")} />
                <div className="space-y-2">
                  <p className="text-destructive font-black text-lg">
                    {diaryError.message.includes('building') ? "ইনডেক্স তৈরির কাজ চলছে..." : "ডাটাবেস ইনডেক্স প্রয়োজন"}
                  </p>
                  <p className="text-sm text-muted-foreground font-bold leading-relaxed">
                    {diaryError.message.includes('building') 
                      ? "ফায়ারবেস বর্তমানে ইনডেক্সটি তৈরি করছে। এটি সম্পন্ন হতে ২-৫ মিনিট সময় লাগতে পারে। অনুগ্রহ করে কিছুক্ষণ পর পেজটি রিফ্রেশ করুন।" 
                      : "ডায়েরি রেকর্ডগুলো সঠিকভাবে দেখানোর জন্য ডাটাবেসে একটি ইনডেক্স তৈরি করতে হবে। নিচের লিঙ্কে ক্লিক করে \"Create Index\" বাটনে চাপ দিন:"}
                  </p>
                  {!diaryError.message.includes('building') && (
                    <>
                      <div className="p-3 bg-muted rounded-lg border text-[10px] break-all font-mono select-all text-left overflow-hidden">
                        https://console.firebase.google.com/v1/r/project/birganj-pouro-high-schoo-9d39d/firestore/indexes?create_composite=Clxwcm9qZWN0cy9iaXJnYW5qLXBvdXJvLWhpZ2gtc2Nob28tOWQzOWQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2RpYXJ5L2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGggKBGRhdGUQARoMCghfX25hbWVfXxAB
                      </div>
                      <a 
                        href="https://console.firebase.google.com/v1/r/project/birganj-pouro-high-schoo-9d39d/firestore/indexes?create_composite=Clxwcm9qZWN0cy9iaXJnYW5qLXBvdXJvLWhpZ2gtc2Nob28tOWQzOWQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2RpYXJ5L2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGggKBGRhdGUQARoMCghfX25hbWVfXxAB" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary/90 transition-all mt-2"
                      >
                        <ExternalLink className="w-4 h-4" /> ইনডেক্স তৈরি করুন
                      </a>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-hidden border-2 border-black rounded-xl shadow-xl bg-white">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-indigo-600 text-white border-b-2 border-black">
                      <th className="p-4 border-r-2 border-black text-sm font-black w-24">তারিখ</th>
                      <th className="p-4 border-r-2 border-black text-sm font-black w-32">শ্রেণি</th>
                      <th className="p-4 border-r-2 border-black text-sm font-black w-40">বিষয়</th>
                      <th className="p-4 text-sm font-black">প্রতিদিনের ক্লাস রেকর্ড (টপিক ও বিস্তারিত)</th>
                      <th className="p-4 border-l-2 border-black text-sm font-black w-24 no-print">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-20 text-center text-muted-foreground font-bold italic border-b-2 border-black">
                          এই মাসে কোনো ডায়েরি রেকর্ড পাওয়া যায়নি।
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry, index) => (
                        <tr key={entry.id} className={cn("border-b-2 border-black hover:bg-slate-50 transition-colors", index % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                          <td className="p-4 border-r-2 border-black text-center">
                            <span className="text-xs font-black bg-indigo-100 text-indigo-800 px-2 py-1 rounded border border-indigo-200">
                              {format(new Date(entry.date), 'dd/MM', { locale: bn })}
                            </span>
                          </td>
                          <td className="p-4 border-r-2 border-black text-center font-black text-sm">
                            {CLASSES.find(c => c.id === entry.classId)?.label} শ্রেণি
                          </td>
                          <td className="p-4 border-r-2 border-black font-bold text-sm text-indigo-700">
                            {entry.subject}
                          </td>
                          <td className="p-4 align-top">
                            <div className="space-y-2">
                              <h4 className="font-black text-base text-foreground leading-tight">{entry.topic}</h4>
                              <p className="text-sm font-bold text-muted-foreground whitespace-pre-wrap leading-relaxed">{entry.notes}</p>
                            </div>
                          </td>
                          <td className="p-4 text-center space-x-2 no-print border-l-2 border-black">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)} className="h-8 w-8 text-indigo-600 hover:bg-indigo-100">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} className="h-8 w-8 text-destructive hover:bg-red-100">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="hidden print:flex justify-between mt-10 px-4 italic text-sm font-bold opacity-50">
              <span>প্রিন্ট তারিখ: {format(new Date(), 'dd MMMM, yyyy', { locale: bn })}</span>
              <span>ডিজিটাল টিচার্স ডায়েরি - স্মার্ট লার্নিং প্ল্যাটফর্ম</span>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-area table { border: 2pt solid black !important; }
          .print-area th, .print-area td { border: 1pt solid black !important; color: black !important; }
          .print-area th { background-color: #f1f5f9 !important; color: black !important; }
        }
      `}</style>
    </div>
  );
}
