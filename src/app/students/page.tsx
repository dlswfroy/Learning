
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, addDoc, deleteDoc, doc, serverTimestamp, getDocs, setDoc, limit, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Loader2, 
  GraduationCap, 
  Phone, 
  Hash, 
  Search, 
  CalendarCheck, 
  Banknote, 
  CheckCircle2, 
  XCircle,
  Save,
  Clock,
  FileBarChart,
  Calendar,
  ClipboardList,
  PlusCircle
} from 'lucide-react';
import { CLASSES } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format, startOfMonth } from 'date-fns';
import { bn } from 'date-fns/locale';

export default function StudentsPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [activeTab, setActiveTab] = useState('list');

  // Sub-tabs states
  const [listSubTab, setListSubTab] = useState<'view' | 'add'>('view');
  const [attendanceSubTab, setAttendanceSubTab] = useState<'daily' | 'report'>('daily');

  // Attendance states
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceClass, setAttendanceClass] = useState('');
  const [attendanceData, setAttendanceData] = useState<Record<string, 'present' | 'absent'>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Attendance Report states
  const [reportStartDate, setReportStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportClass, setReportClass] = useState('');

  // Fees states
  const [feeStudentId, setFeeStudentId] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeMonth, setFeeMonth] = useState(format(new Date(), 'MMMM'));
  const [feeYear, setFeeYear] = useState(new Date().getFullYear().toString());
  const [savingFee, setSavingFee] = useState(false);

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

  const classStudents = useMemo(() => {
    if (!students || !attendanceClass) return [];
    return students.filter(s => s.classId === attendanceClass)
      .sort((a, b) => (a.roll || '').localeCompare(b.roll || '', 'bn', { numeric: true }));
  }, [students, attendanceClass]);

  const reportQuery = useMemo(() => {
    if (!db || !user || !reportClass || !reportStartDate || !reportEndDate) return null;
    return query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid),
      where('classId', '==', reportClass),
      where('date', '>=', reportStartDate),
      where('date', '<=', reportEndDate),
      orderBy('date', 'desc')
    );
  }, [db, user, reportClass, reportStartDate, reportEndDate]);

  const { data: reportRecords, loading: reportLoading } = useCollection(reportQuery);

  const feesQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'fees'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(10)
    );
  }, [db, user]);
  const { data: recentFees, loading: feesLoading } = useCollection(feesQuery);

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
        setListSubTab('view');
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'students', operation: 'create', requestResourceData: studentData
        }));
      })
      .finally(() => setAdding(false));
  };

  const handleSaveAttendance = async () => {
    if (!db || !user || !attendanceClass) return;
    setSavingAttendance(true);
    
    try {
      const batchPromises = classStudents.map(student => {
        const id = `${student.id}_${attendanceDate}`;
        const ref = doc(db, 'attendance', id);
        return setDoc(ref, {
          studentId: student.id,
          date: attendanceDate,
          status: attendanceData[student.id] || 'present',
          classId: attendanceClass,
          userId: user.uid
        }, { merge: true });
      });
      
      await Promise.all(batchPromises);
      toast({ title: "সফল", description: "হাজিরা সংরক্ষিত হয়েছে।" });
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "হাজিরা সেভ করা সম্ভব হয়নি।" });
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !feeStudentId || !feeAmount) return;
    setSavingFee(true);

    const feeData = {
      studentId: feeStudentId,
      amount: parseFloat(feeAmount),
      month: feeMonth,
      year: feeYear,
      date: serverTimestamp(),
      userId: user.uid
    };

    addDoc(collection(db, 'fees'), feeData)
      .then(() => {
        toast({ title: "সফল", description: "বেতন আদায় রেকর্ড করা হয়েছে।" });
        setFeeStudentId('');
        setFeeAmount('');
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'fees', operation: 'create', requestResourceData: feeData
        }));
      })
      .finally(() => setSavingFee(false));
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
        <p className="mt-4 text-muted-foreground font-bold">লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20 font-kalpurush">
      <header className="flex items-center gap-4 border-b pb-4 no-print">
        <div className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center shadow-sm">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold">শিক্ষার্থী ব্যবস্থাপনা</h2>
          <p className="text-xs text-muted-foreground font-bold">হাজিরা, বেতন এবং তথ্য পরিচালনা করুন</p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full no-print">
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-secondary/50 p-1 h-14">
          <TabsTrigger value="list" className="gap-2 font-bold text-sm h-12">
            <Users className="w-4 h-4" /> শিক্ষার্থী তালিকা
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2 font-bold text-sm h-12">
            <CalendarCheck className="w-4 h-4" /> হাজিরা
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-2 font-bold text-sm h-12">
            <Banknote className="w-4 h-4" /> বেতন আদায়
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant={listSubTab === 'view' ? 'default' : 'outline'} 
              onClick={() => setListSubTab('view')}
              className="gap-2 font-bold"
            >
              <ClipboardList className="w-4 h-4" /> শিক্ষার্থীর তালিকা
            </Button>
            <Button 
              variant={listSubTab === 'add' ? 'default' : 'outline'} 
              onClick={() => setListSubTab('add')}
              className="gap-2 font-bold"
            >
              <PlusCircle className="w-4 h-4" /> নতুন শিক্ষার্থী
            </Button>
          </div>

          {listSubTab === 'view' ? (
            <Card className="shadow-md border-green-100">
              <CardHeader className="bg-green-50/50 border-b py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2 font-bold text-green-700">
                    <Users className="w-5 h-5" /> শিক্ষার্থীর তালিকা
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 font-bold w-full sm:w-64 h-9" />
                    </div>
                    <Select value={filterClass} onValueChange={setFilterClass}>
                      <SelectTrigger className="w-full sm:w-40 font-bold h-9">
                        <SelectValue placeholder="সব শ্রেণি" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">সব শ্রেণি</SelectItem>
                        {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground font-bold">কোনো শিক্ষার্থী পাওয়া যায়নি</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredStudents.map(s => (
                      <div key={s.id} className="p-4 border rounded-xl flex items-center gap-4 bg-white hover:border-green-400 transition-all shadow-sm">
                        <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-black text-lg shrink-0">
                          {s.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-base truncate">{s.name}</h4>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] font-bold text-muted-foreground">
                            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3 text-green-600" /> {CLASSES.find(c => c.id === s.classId)?.label} শ্রেণি</span>
                            <span className="flex items-center gap-1"><Hash className="w-3 h-3 text-green-600" /> রোল: {s.roll}</span>
                            {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-green-600" /> {s.phone}</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-md border-green-100 max-w-2xl mx-auto">
              <CardHeader className="bg-green-50/50 border-b py-4 text-center">
                <CardTitle className="text-lg flex items-center justify-center gap-2 font-bold text-green-700">
                  <UserPlus className="w-5 h-5" /> নতুন শিক্ষার্থী যুক্ত করুন
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">শিক্ষার্থীর নাম</label>
                    <Input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="পুরো নাম" className="font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">শ্রেণি নির্বাচন করুন</label>
                      <Select onValueChange={v => setFormData(p => ({...p, classId: v}))} value={formData.classId}>
                        <SelectTrigger className="font-bold"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                        <SelectContent>
                          {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">রোল নম্বর</label>
                      <Input value={formData.roll} onChange={e => setFormData(p => ({...p, roll: e.target.value}))} placeholder="রোল" className="font-bold" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">মোবাইল নম্বর (পিতামাতা)</label>
                    <Input value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} placeholder="০১৭XXXXXXXX" className="font-bold" />
                  </div>
                  <div className="pt-4">
                    <Button type="submit" disabled={adding} className="w-full font-bold bg-green-600 hover:bg-green-700 h-11 text-white shadow-lg">
                      {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} সংরক্ষণ করুন
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant={attendanceSubTab === 'daily' ? 'default' : 'outline'} 
              onClick={() => setAttendanceSubTab('daily')}
              className="gap-2 font-bold"
            >
              <ClipboardList className="w-4 h-4" /> দৈনিক হাজিরা
            </Button>
            <Button 
              variant={attendanceSubTab === 'report' ? 'default' : 'outline'} 
              onClick={() => setAttendanceSubTab('report')}
              className="gap-2 font-bold"
            >
              <FileBarChart className="w-4 h-4" /> রিপোর্ট
            </Button>
          </div>

          {attendanceSubTab === 'daily' ? (
            <Card className="shadow-md">
              <CardHeader className="bg-primary/5 border-b py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2 font-bold">
                    <CalendarCheck className="w-5 h-5 text-primary" /> দৈনিক হাজিরা ইনপুট
                  </CardTitle>
                  <div className="flex flex-wrap gap-3">
                    <Input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="w-40 font-bold" />
                    <Select onValueChange={setAttendanceClass} value={attendanceClass}>
                      <SelectTrigger className="w-40 font-bold"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                      <SelectContent>
                        {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {!attendanceClass ? (
                  <div className="text-center py-10 text-muted-foreground font-bold">শ্রেণি নির্বাচন করুন</div>
                ) : classStudents.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground font-bold">এই শ্রেণিতে কোনো শিক্ষার্থী নেই</div>
                ) : (
                  <div className="space-y-3">
                    {classStudents.map(s => {
                      const status = attendanceData[s.id] || 'present';
                      return (
                        <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-muted/5 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 flex items-center justify-center bg-secondary rounded-full font-bold text-xs">{s.roll}</span>
                            <span className="font-bold">{s.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant={status === 'present' ? 'default' : 'outline'} 
                              size="sm" 
                              className={`gap-1 font-bold ${status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                              onClick={() => setAttendanceData(p => ({...p, [s.id]: 'present'}))}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> উপস্থিত
                            </Button>
                            <Button 
                              variant={status === 'absent' ? 'destructive' : 'outline'} 
                              size="sm" 
                              className="gap-1 font-bold"
                              onClick={() => setAttendanceData(p => ({...p, [s.id]: 'absent'}))}
                            >
                              <XCircle className="w-3.5 h-3.5" /> অনুপস্থিত
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-6 border-t flex justify-end">
                      <Button onClick={handleSaveAttendance} disabled={savingAttendance} className="gap-2 font-bold px-10">
                        {savingAttendance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} হাজিরা সেভ করুন
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-md">
              <CardHeader className="bg-orange-50/50 border-b py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2 font-bold text-orange-700">
                    <FileBarChart className="w-5 h-5" /> হাজিরা রিপোর্ট
                  </CardTitle>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">শুরু</span>
                      <Input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-40 font-bold" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">শেষ</span>
                      <Input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-40 font-bold" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">শ্রেণি</span>
                      <Select onValueChange={setReportClass} value={reportClass}>
                        <SelectTrigger className="w-40 font-bold h-9"><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                        <SelectContent>
                          {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {!reportClass ? (
                  <div className="text-center py-10 text-muted-foreground font-bold">রিপোর্ট দেখতে শ্রেণি নির্বাচন করুন</div>
                ) : reportLoading ? (
                  <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                ) : !reportRecords || reportRecords.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground font-bold">এই সময়সীমার কোনো হাজিরা রেকর্ড পাওয়া যায়নি।</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                        <p className="text-[10px] font-bold text-blue-600 uppercase">মোট রেকর্ড</p>
                        <p className="text-2xl font-black text-blue-700">{reportRecords.length}</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                        <p className="text-[10px] font-bold text-green-600 uppercase">মোট উপস্থিত</p>
                        <p className="text-2xl font-black text-green-700">{reportRecords.filter(r => r.status === 'present').length}</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                        <p className="text-[10px] font-bold text-red-600 uppercase">মোট অনুপস্থিত</p>
                        <p className="text-2xl font-black text-red-700">{reportRecords.filter(r => r.status === 'absent').length}</p>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="p-3 text-left font-bold">তারিখ</th>
                            <th className="p-3 text-left font-bold">রোল</th>
                            <th className="p-3 text-left font-bold">নাম</th>
                            <th className="p-3 text-center font-bold">অবস্থা</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {reportRecords.map(record => {
                            const student = students?.find(s => s.id === record.studentId);
                            return (
                              <tr key={record.id} className="hover:bg-muted/5">
                                <td className="p-3 font-bold text-muted-foreground text-xs whitespace-nowrap">
                                  {format(new Date(record.date), 'dd MMM, yy', { locale: bn })}
                                </td>
                                <td className="p-3 font-bold">{student?.roll || '-'}</td>
                                <td className="p-3 font-bold">{student?.name || 'অজানা'}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {record.status === 'present' ? 'উপস্থিত' : 'অনুপস্থিত'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fees" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 shadow-md border-orange-100">
              <CardHeader className="bg-orange-50 border-b py-3">
                <CardTitle className="text-base flex items-center gap-2 font-bold text-orange-700">
                  <Banknote className="w-4 h-4" /> বেতন আদায় রেকর্ড
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSaveFee} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">শিক্ষার্থী</label>
                    <Select onValueChange={setFeeStudentId} value={feeStudentId}>
                      <SelectTrigger className="font-bold"><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>
                        {students?.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (রোল: {s.roll}, {CLASSES.find(c => c.id === s.classId)?.label})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">টাকার পরিমাণ</label>
                    <Input type="number" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} placeholder="০০০" className="font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">মাস</label>
                      <Select onValueChange={setFeeMonth} value={feeMonth}>
                        <SelectTrigger className="font-bold"><SelectValue placeholder="মাস" /></SelectTrigger>
                        <SelectContent>
                          {['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">বছর</label>
                      <Input value={feeYear} onChange={e => setFeeYear(e.target.value)} className="font-bold" />
                    </div>
                  </div>
                  <Button type="submit" disabled={savingFee} className="w-full font-bold bg-orange-600 hover:bg-orange-700 h-10">
                    {savingFee ? <Loader2 className="w-4 h-4 animate-spin" /> : 'আদায় রেকর্ড করুন'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 shadow-md">
              <CardHeader className="bg-muted/30 border-b py-3">
                <CardTitle className="text-base flex items-center gap-2 font-bold">
                  <Clock className="w-4 h-4" /> সাম্প্রতিক পেমেন্ট
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {feesLoading ? (
                  <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                ) : recentFees && recentFees.length > 0 ? (
                  <div className="divide-y">
                    {recentFees.map(f => {
                      const student = students?.find(s => s.id === f.studentId);
                      return (
                        <div key={f.id} className="p-4 flex items-center justify-between hover:bg-muted/5">
                          <div className="space-y-1">
                            <p className="font-bold text-sm text-primary">{student?.name || 'অজানা শিক্ষার্থী'}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">
                              {f.month} {f.year} | {f.date?.toDate ? format(f.date.toDate(), 'dd MMM, hh:mm a', { locale: bn }) : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-orange-600">৳{f.amount}</p>
                            <p className="text-[8px] font-bold text-muted-foreground">সংগৃহীত</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-10 text-center text-muted-foreground font-bold">কোনো রেকর্ড পাওয়া যায়নি</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
