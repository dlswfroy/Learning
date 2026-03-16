
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, Trash2, Loader2, GraduationCap, Phone, Hash, Search } from 'lucide-react';
import { CLASSES } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function StudentsPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    classId: '',
    roll: '',
    phone: ''
  });

  const studentsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, 'students'), where('userId', '==', user.uid));
  }, [db, user]);

  const { data: students, loading: studentsLoading } = useCollection(studentsQuery);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => {
      const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.roll?.includes(search) || s.phone?.includes(search);
      const matchClass = filterClass === 'all' || s.classId === filterClass;
      return matchSearch && matchClass;
    }).sort((a, b) => (a.roll || '').localeCompare(b.roll || '', 'bn', { numeric: true }));
  }, [students, search, filterClass]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;
    if (!formData.name || !formData.classId) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "নাম এবং শ্রেণি অবশ্যই লিখুন।" });
      return;
    }

    setAdding(true);
    const studentData = {
      ...formData,
      userId: user.uid,
      createdAt: serverTimestamp()
    };

    addDoc(collection(db, 'students'), studentData)
      .then(() => {
        toast({ title: "সফল", description: "শিক্ষার্থীর তথ্য যুক্ত হয়েছে।" });
        setFormData({ name: '', classId: '', roll: '', phone: '' });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'students', operation: 'create', requestResourceData: studentData
        }));
      })
      .finally(() => setAdding(false));
  };

  const handleDelete = (id: string) => {
    if (!db || !confirm("আপনি কি নিশ্চিত?")) return;
    deleteDoc(doc(db, 'students', id))
      .then(() => toast({ title: "সফল", description: "শিক্ষার্থীর তথ্য মুছে ফেলা হয়েছে।" }))
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `students/${id}`, operation: 'delete'
        }));
      });
  };

  if (userLoading || studentsLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-bold">শিক্ষার্থী তালিকা লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
      <header className="flex items-center gap-4 border-b pb-4">
        <div className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center shadow-sm">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold">শিক্ষার্থী ব্যবস্থাপনা</h2>
          <p className="text-xs text-muted-foreground font-bold">আপনার শিক্ষার্থীদের তালিকা ও তথ্য পরিচালনা করুন</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Student Form */}
        <Card className="lg:col-span-1 h-fit shadow-md border-green-100">
          <CardHeader className="bg-green-50/50 border-b py-3">
            <CardTitle className="text-base flex items-center gap-2 font-bold text-green-700">
              <UserPlus className="w-4 h-4" /> নতুন শিক্ষার্থী যোগ করুন
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold">শিক্ষার্থীর নাম</label>
                <Input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="পুরো নাম লিখুন" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold">শ্রেণি</label>
                  <Select onValueChange={v => setFormData(p => ({...p, classId: v}))} value={formData.classId}>
                    <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                    <SelectContent>
                      {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold">রোল</label>
                  <Input value={formData.roll} onChange={e => setFormData(p => ({...p, roll: e.target.value}))} placeholder="রোল" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">ফোন নম্বর</label>
                <Input value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} placeholder="০১৭XXXXXXXX" />
              </div>
              <Button type="submit" disabled={adding} className="w-full font-bold bg-green-600 hover:bg-green-700 h-10 gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} সংরক্ষণ করুন
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Student List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="নাম, রোল বা ফোনে খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 font-bold" />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-full sm:w-40 font-bold">
                <SelectValue placeholder="সব শ্রেণি" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব শ্রেণি</SelectItem>
                {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStudents.length > 0 ? (
              filteredStudents.map(s => (
                <Card key={s.id} className="hover:border-green-400 transition-all group bg-white shadow-sm overflow-hidden">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-black text-lg shrink-0">
                      {s.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-base truncate group-hover:text-green-700 transition-colors">{s.name}</h4>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] font-bold text-muted-foreground">
                        <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3 text-green-600" /> {CLASSES.find(c => c.id === s.classId)?.label} শ্রেণি</span>
                        <span className="flex items-center gap-1"><Hash className="w-3 h-3 text-green-600" /> রোল: {s.roll}</span>
                        {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-green-600" /> {s.phone}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-destructive hover:bg-destructive/10 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-muted/5">
                <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground font-bold">কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
