
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
  GraduationCap, 
  ChevronRight, 
  Loader2, 
  Search,
  Book,
  ArrowLeft,
  FileText
} from 'lucide-react';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');

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
      orderBy('date', 'desc')
    );
  }, [db, user]);

  const { data: diaryEntries, loading: diaryLoading } = useCollection(diaryQuery);

  const filteredEntries = useMemo(() => {
    if (!diaryEntries) return [];
    return diaryEntries.filter(entry => {
      const matchSearch = entry.topic?.toLowerCase().includes(search.toLowerCase()) || 
                          entry.notes?.toLowerCase().includes(search.toLowerCase()) ||
                          entry.subject?.toLowerCase().includes(search.toLowerCase());
      const matchClass = filterClass === 'all' || entry.classId === filterClass;
      return matchSearch && matchClass;
    });
  }, [diaryEntries, search, filterClass]);

  const subjectsList = useMemo(() => formData.classId ? getSubjectsForClass(formData.classId) : [], [formData.classId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    if (!formData.date || !formData.topic) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "তারিখ ও টপিক অবশ্যই লিখুন।" });
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
        <p className="mt-4 text-muted-foreground font-bold">ডায়েরি লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20 font-kalpurush">
      <header className="flex items-center justify-between border-b pb-6">
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
        <Card className="shadow-xl border-indigo-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="bg-indigo-50/50 border-b">
            <CardTitle className="text-lg font-black text-indigo-700 flex items-center gap-2">
              <FileText className="w-5 h-5" /> {editingId ? "ডায়েরি আপডেট করুন" : "নতুন ডায়েরি এন্ট্রি"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">তারিখ</label>
                  <Input 
                    type="date" 
                    value={formData.date} 
                    onChange={e => setFormData(p => ({...p, date: e.target.value}))} 
                    className="font-bold h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">শ্রেণি</label>
                  <Select onValueChange={v => setFormData(p => ({...p, classId: v}))} value={formData.classId}>
                    <SelectTrigger className="font-bold h-11"><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">বিষয়</label>
                  <Select onValueChange={v => setFormData(p => ({...p, subject: v}))} value={formData.subject} disabled={!formData.classId}>
                    <SelectTrigger className="font-bold h-11"><SelectValue placeholder="বিষয়" /></SelectTrigger>
                    <SelectContent>
                      {subjectsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">টপিক / শিরোনাম</label>
                  <Input 
                    value={formData.topic} 
                    onChange={e => setFormData(p => ({...p, topic: e.target.value}))} 
                    placeholder="যেমন: ৩য় অধ্যায় - বল ও গতি আলোচনা" 
                    className="font-bold h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">বিস্তারিত নোট / লেসন প্ল্যান</label>
                <Textarea 
                  value={formData.notes} 
                  onChange={e => setFormData(p => ({...p, notes: e.target.value}))} 
                  placeholder="আজকের ক্লাসের সারসংক্ষেপ বা আগামী দিনের পরিকল্পনা এখানে লিখুন..." 
                  className="min-h-[150px] font-bold text-base leading-relaxed"
                />
              </div>
              <Button type="submit" disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-lg font-black shadow-lg">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                {editingId ? "আপডেট করুন" : "ডায়েরি সেভ করুন"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="সার্চ করুন..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="pl-9 font-bold"
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-full sm:w-40 font-bold"><SelectValue placeholder="সব শ্রেণি" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব শ্রেণি</SelectItem>
                {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredEntries.length === 0 ? (
              <Card className="p-20 text-center border-dashed border-2 bg-muted/5">
                <p className="text-muted-foreground font-bold">কোনো ডায়েরি রেকর্ড পাওয়া যায়নি</p>
              </Card>
            ) : (
              filteredEntries.map(entry => (
                <Card key={entry.id} className="group hover:border-indigo-300 transition-all shadow-sm border-l-4 border-l-indigo-600">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                            <Calendar className="w-3 h-3 mr-1" />
                            {format(new Date(entry.date), 'dd MMMM, yyyy', { locale: bn })}
                          </Badge>
                          <Badge className="bg-orange-50 text-orange-700 font-bold text-[10px]">
                            <GraduationCap className="w-3 h-3 mr-1" />
                            {CLASSES.find(c => c.id === entry.classId)?.label} শ্রেণি
                          </Badge>
                          <Badge variant="outline" className="font-bold text-[10px] text-muted-foreground border-indigo-200">
                            <Book className="w-3 h-3 mr-1" />
                            {entry.subject}
                          </Badge>
                        </div>
                        <h3 className="text-lg font-black text-foreground group-hover:text-indigo-700 transition-colors">
                          {entry.topic}
                        </h3>
                        <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed font-bold">
                          {entry.notes}
                        </p>
                      </div>
                      <div className="flex md:flex-col gap-2 shrink-0 md:justify-center">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)} className="h-9 w-9 text-indigo-600 hover:bg-indigo-50">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} className="h-9 w-9 text-destructive hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
