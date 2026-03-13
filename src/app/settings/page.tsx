
"use client";

import { useState, useMemo, useEffect } from 'react';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Upload, FileText, CheckCircle, Trash2, Loader2, AlertCircle, ShieldAlert, LogIn, Info, Link as LinkIcon, Globe } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useStorage, useUser } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';

export default function SettingsPage() {
  const db = useFirestore();
  const storage = useStorage();
  const { user, loading: userLoading } = useUser();
  
  const [classId, setClassId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'link'>('file');

  useEffect(() => {
    async function checkAdmin() {
      if (!user || !db) {
        setIsAdmin(false);
        setAdminChecking(false);
        return;
      }
      
      try {
        const adminDocRef = doc(db, 'config', 'admin');
        const adminDoc = await getDoc(adminDocRef);
        
        if (adminDoc.exists()) {
          setIsAdmin(adminDoc.data().adminUid === user.uid);
        } else {
          // If no admin exists, current user becomes admin
          await setDoc(adminDocRef, { adminUid: user.uid });
          setIsAdmin(true);
        }
      } catch (e) {
        console.error("Admin check failed", e);
      } finally {
        setAdminChecking(false);
      }
    }
    checkAdmin();
  }, [user, db]);

  const booksQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'books');
  }, [db]);

  const { data: rawBooks, loading: loadingBooks } = useCollection(booksQuery);

  const uploadedBooks = useMemo(() => {
    if (!rawBooks) return [];
    return [...rawBooks].sort((a, b) => {
      const dateA = a.uploadedAt?.toDate?.() || new Date(0);
      const dateB = b.uploadedAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [rawBooks]);

  const subjects = classId ? getSubjectsForClass(classId) : [];

  const handleSaveBook = async () => {
    if (!isAdmin) {
      toast({ title: "অনুমতি নেই", description: "শুধুমাত্র এডমিন বই যোগ করতে পারবেন।", variant: "destructive" });
      return;
    }

    if (!classId || !subject || !db) {
      toast({ title: "তথ্য অসম্পূর্ণ", description: "শ্রেণি এবং বিষয় নির্বাচন করুন।", variant: "destructive" });
      return;
    }

    if (uploadMethod === 'file') {
      if (!file || !storage) {
        toast({ title: "ফাইল নেই", description: "অনুগ্রহ করে একটি PDF ফাইল নির্বাচন করুন।", variant: "destructive" });
        return;
      }
      
      setUploading(true);
      setProgress(0);
      
      try {
        const storagePath = `books/${classId}/${subject}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progressPercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(progressPercent);
          },
          (error) => {
            setUploading(false);
            toast({ title: "আপলোড ব্যর্থ", description: "ইন্টারনেট কানেকশন চেক করুন। " + error.message, variant: "destructive" });
          },
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            saveToFirestore(downloadUrl, file.name);
          }
        );
      } catch (error: any) {
        setUploading(false);
        toast({ title: "ত্রুটি", description: error.message, variant: "destructive" });
      }
    } else {
      if (!pdfUrl) {
        toast({ title: "লিঙ্ক নেই", description: "অনুগ্রহ করে এনসিটিবি বা অন্য সোর্স থেকে ডাউনলোড লিঙ্কটি দিন।", variant: "destructive" });
        return;
      }
      setUploading(true);
      saveToFirestore(pdfUrl, `${subject}_বই_লিঙ্ক`);
    }
  };

  const saveToFirestore = (url: string, fileName: string) => {
    const bookData = {
      classId,
      subject,
      fileName: fileName,
      pdfUrl: url,
      uploadedAt: serverTimestamp(),
      userId: user?.uid,
    };

    addDoc(collection(db!, 'books'), bookData)
      .then(() => {
        setUploading(false);
        setFile(null);
        setPdfUrl('');
        setProgress(0);
        toast({ title: "সফল", description: "বইটি সফলভাবে যুক্ত করা হয়েছে।" });
      })
      .catch(async () => {
        setUploading(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'books', operation: 'create', requestResourceData: bookData
        }));
      });
  };

  const removeBook = (bookId: string) => {
    if (!isAdmin || !db) return;
    if (!confirm("মুছে ফেলতে চান?")) return;

    deleteDoc(doc(db, 'books', bookId))
      .then(() => toast({ title: "মুছে ফেলা হয়েছে" }))
      .catch(() => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `books/${bookId}`, operation: 'delete'
        }));
      });
  };

  if (userLoading || adminChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-medium">অ্যাক্সেস চেক করা হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      <header className="flex items-center gap-4 border-b pb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
          <Settings className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">সেটিং</h2>
          <p className="text-sm text-muted-foreground">বই ম্যানেজমেন্ট এবং নতুন কন্টেন্ট যোগ করুন</p>
        </div>
      </header>

      {!user ? (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-accent" />
            <div className="space-y-1">
              <h3 className="font-bold">লগইন প্রয়োজন</h3>
              <p className="text-sm text-muted-foreground">বই ম্যানেজ করতে অনুগ্রহ করে প্রথমে লগইন করুন।</p>
            </div>
            <Link href="/auth">
              <Button className="bg-accent hover:bg-accent/90 gap-2">
                <LogIn className="w-4 h-4" /> লগইন পেজে যান
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : !isAdmin ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <ShieldAlert className="w-10 h-10 text-destructive" />
            <div className="space-y-1">
              <h3 className="font-bold text-destructive">এডমিন অ্যাক্সেস নেই</h3>
              <p className="text-sm text-muted-foreground">শুধুমাত্র এডমিন বই যোগ বা ডিলিট করতে পারবেন।</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <Upload className="w-5 h-5" />
              নতুন বই যোগ করুন
            </h3>
            <span className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold">Admin Active</span>
          </div>

          <Card className="border-2 border-primary/10">
            <CardHeader className="pb-2">
              <Tabs defaultValue="file" onValueChange={(v) => setUploadMethod(v as 'file' | 'link')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file" className="gap-2">
                    <Upload className="w-4 h-4" /> ফাইল আপলোড
                  </TabsTrigger>
                  <TabsTrigger value="link" className="gap-2">
                    <LinkIcon className="w-4 h-4" /> লিঙ্ক/URL যোগ
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">শ্রেণি</label>
                <Select onValueChange={setClassId} value={classId || ''}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="নির্বাচন করুন" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">বিষয়</label>
                <Select onValueChange={setSubject} value={subject || ''} disabled={!classId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="নির্বাচন করুন" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {uploadMethod === 'file' ? (
                  <>
                    <label className="text-sm font-semibold">PDF ফাইল</label>
                    <Input 
                      type="file" 
                      accept=".pdf" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="cursor-pointer"
                      disabled={uploading}
                    />
                  </>
                ) : (
                  <>
                    <label className="text-sm font-semibold">ডাউনলোড লিঙ্ক (URL)</label>
                    <Input 
                      placeholder="https://nctb.gov.bd/..." 
                      value={pdfUrl || ''}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      disabled={uploading}
                    />
                  </>
                )}
              </div>
            </CardContent>

            {uploading && uploadMethod === 'file' && (
              <div className="px-6 pb-4 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-primary flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> {progress < 100 ? 'আপলোড হচ্ছে...' : 'প্রসেসিং...'}
                  </span>
                  <span className="text-primary">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                {file && file.size > 50 * 1024 * 1024 && (
                  <p className="text-[10px] text-orange-600 text-center">আপনার ফাইলটি বড়, ট্যাবটি বন্ধ করবেন না।</p>
                )}
              </div>
            )}

            <CardFooter className="flex justify-between border-t bg-muted/20 py-4">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Globe className="w-3 h-3" />
                এনসিটিবি সাইট থেকে লিঙ্ক দিলে কোনো আপলোড সময় লাগবে না।
              </div>
              <Button 
                onClick={handleSaveBook} 
                disabled={uploading || (uploadMethod === 'file' ? !file : !pdfUrl) || !classId || !subject} 
                className="gap-2 bg-accent hover:bg-accent/90"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {uploadMethod === 'link' ? 'তাৎক্ষণিক সেভ করুন' : 'বই সেভ করুন'}
              </Button>
            </CardFooter>
          </Card>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          বর্তমানে থাকা বইসমূহ
        </h3>
        {loadingBooks ? (
          <div className="flex flex-col items-center justify-center p-12 bg-secondary/10 rounded-lg">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">তালিকা লোড হচ্ছে...</p>
          </div>
        ) : uploadedBooks.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2">
            <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">কোনো বই এখনো যোগ করা হয়নি।</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {uploadedBooks.map((book) => (
              <Card key={book.id} className="p-4 flex items-center justify-between hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-sm truncate">{book.subject} - {CLASSES.find(c => c.id === book.classId)?.label} শ্রেণি</h4>
                    <p className="text-[10px] text-muted-foreground italic truncate">{book.fileName}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeBook(book.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
