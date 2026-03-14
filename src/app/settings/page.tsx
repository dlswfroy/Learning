
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Upload, FileText, CheckCircle, Trash2, Loader2, ShieldAlert, Link as LinkIcon, Globe, Image as ImageIcon, Filter } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useStorage, useUser } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function SettingsPage() {
  const db = useFirestore();
  const storage = useStorage();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  
  const [classId, setClassId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'link'>('file');
  const [viewClassId, setViewClassId] = useState<string>('all');

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/auth');
    }
  }, [user, userLoading, router]);

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
          setIsAdmin(adminDoc.data()?.adminUid === user.uid);
        } else {
          await setDoc(adminDocRef, { adminUid: user.uid });
          setIsAdmin(true);
        }
      } catch (e) {
        console.error("Admin check failed", e);
      } finally {
        setAdminChecking(false);
      }
    }
    if (user) checkAdmin();
  }, [user, db]);

  const booksQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'books');
  }, [db]);

  const { data: rawBooks, loading: loadingBooks } = useCollection(booksQuery);

  const uploadedBooks = useMemo(() => {
    if (!rawBooks) return [];
    return [...rawBooks].sort((a, b) => {
      const dateA = (a.uploadedAt as any)?.toDate?.() || new Date(0);
      const dateB = (b.uploadedAt as any)?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [rawBooks]);

  const filteredBooks = useMemo(() => {
    if (!viewClassId || viewClassId === 'all') return uploadedBooks;
    return uploadedBooks.filter(b => b.classId === viewClassId);
  }, [uploadedBooks, viewClassId]);

  const subjectsList = useMemo(() => classId ? getSubjectsForClass(classId) : [], [classId]);

  const handleSaveBook = async () => {
    if (!isAdmin) {
      toast({ title: "অনুমতি নেই", description: "শুধুমাত্র এডমিন বই যোগ করতে পারবেন।", variant: "destructive" });
      return;
    }
    if (!classId || !subject || !db) {
      toast({ title: "অসম্পূর্ণ তথ্য", description: "শ্রেণি এবং বিষয় নির্বাচন করুন।", variant: "destructive" });
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
          (snapshot) => { setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); },
          (error) => {
            setUploading(false);
            toast({ title: "আপলোড ব্যর্থ", description: "ইন্টারনেট কানেকশন চেক করুন।", variant: "destructive" });
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
        toast({ title: "লিঙ্ক নেই", description: "অনুগ্রহ করে ডাউনলোড লিঙ্কটি দিন।", variant: "destructive" });
        return;
      }
      setUploading(true);
      saveToFirestore(pdfUrl, subject);
    }
  };

  const saveToFirestore = (url: string, fileName: string) => {
    const bookData = {
      classId: classId || '',
      subject: subject || '',
      fileName: fileName || '',
      pdfUrl: url || '',
      coverImageUrl: coverImageUrl || '',
      uploadedAt: serverTimestamp(),
      userId: user?.uid || '',
    };
    addDoc(collection(db!, 'books'), bookData)
      .then(() => {
        setUploading(false);
        setFile(null);
        setPdfUrl('');
        setCoverImageUrl('');
        setClassId('');
        setSubject('');
        setProgress(0);
        toast({ title: "সফল", description: "বইটি সফলভাবে যুক্ত করা হয়েছে।" });
      })
      .catch(async () => {
        setUploading(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'books',
          operation: 'create',
          requestResourceData: bookData
        }));
      });
  };

  const removeBook = (bookId: string) => {
    if (!isAdmin || !db) {
      toast({ title: "অনুমতি নেই", variant: "destructive" });
      return;
    }
    if (!confirm("আপনি কি নিশ্চিতভাবে এই বইটি মুছে ফেলতে চান?")) return;
    deleteDoc(doc(db, 'books', bookId))
      .then(() => {
        toast({ title: "সফল", description: "বইটি মুছে ফেলা হয়েছে।" });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `books/${bookId}`,
          operation: 'delete'
        }));
      });
  };

  if (userLoading || (user && adminChecking)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      <header className="flex items-center gap-4 border-b pb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
          <Settings className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold">সেটিং</h2>
      </header>

      {!isAdmin ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <ShieldAlert className="w-10 h-10 text-destructive" />
            <h3 className="font-bold text-destructive text-lg">এডমিন অ্যাক্সেস নেই</h3>
            <p className="text-sm text-muted-foreground">শুধুমাত্র এডমিনগণ বই যোগ বা পরিবর্তন করতে পারেন।</p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          <Card className="border-2 border-primary/10">
            <CardHeader className="pb-2">
              <Tabs defaultValue="file" onValueChange={(v) => setUploadMethod(v as 'file' | 'link')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file" className="gap-2">
                    <Upload className="w-4 h-4" /> ফাইল আপলোড
                  </TabsTrigger>
                  <TabsTrigger value="link" className="gap-2">
                    <LinkIcon className="w-4 h-4" /> লিঙ্ক যোগ
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">শ্রেণি</label>
                  <Select key={`sel-cls-${classId}`} onValueChange={setClassId} value={classId || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSES.map((c) => (
                        <SelectItem key={`opt-${c.id}`} value={c.id}>{c.label} শ্রেণি</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">বিষয়</label>
                  <Select key={`sel-sub-${subject}`} onValueChange={setSubject} value={subject || ''} disabled={!classId}>
                    <SelectTrigger>
                      <SelectValue placeholder="নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectsList.map((s) => (
                        <SelectItem key={`opt-${s}`} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">{uploadMethod === 'file' ? 'PDF ফাইল' : 'ডাউনলোড লিঙ্ক'}</label>
                  {uploadMethod === 'file' ? (
                    <Input 
                      key="f-inp"
                      type="file" 
                      accept=".pdf" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                    />
                  ) : (
                    <Input 
                      key="u-inp"
                      placeholder="https://..." 
                      value={pdfUrl || ''} 
                      onChange={(e) => setPdfUrl(e.target.value)}
                      disabled={uploading}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">কভার ইমেজ (ঐচ্ছিক)</label>
                  <Input 
                    key="c-inp"
                    placeholder="https://..." 
                    value={coverImageUrl || ''} 
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    disabled={uploading}
                  />
                </div>
              </div>
            </CardContent>
            {uploading && uploadMethod === 'file' && (
              <div className="px-6 pb-4 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>আপলোড হচ্ছে...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
            <CardFooter className="flex justify-end border-t bg-muted/20 py-4">
              <Button 
                onClick={handleSaveBook} 
                disabled={uploading || (uploadMethod === 'file' ? !file : !pdfUrl) || !classId || !subject}
                className="bg-accent text-white hover:bg-accent/90 gap-2 px-8"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {uploadMethod === 'link' ? 'সেভ করুন' : 'আপলোড করুন'}
              </Button>
            </CardFooter>
          </Card>
        </section>
      )}

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold">বর্তমানে থাকা বইসমূহ</h3>
          <div className="flex items-center gap-2 bg-secondary/30 p-1.5 rounded-lg border">
            <Filter className="w-4 h-4 text-muted-foreground ml-2" />
            <Select value={viewClassId} onValueChange={setViewClassId}>
              <SelectTrigger className="w-[150px] h-8 text-xs bg-white">
                <SelectValue placeholder="সব শ্রেণি" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব শ্রেণি</SelectItem>
                {CLASSES.map((c) => (
                  <SelectItem key={`filter-opt-${c.id}`} value={c.id}>{c.label} শ্রেণি</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadingBooks ? (
          <div className="p-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          </div>
        ) : filteredBooks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBooks.map((book) => (
              <Card key={book.id} className="p-4 flex items-center justify-between hover:border-primary/40 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-16 rounded border bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                    {book.coverImageUrl ? (
                      <img src={book.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{book.subject}</h4>
                    <p className="text-[10px] text-muted-foreground">
                      {CLASSES.find(c => c.id === book.classId)?.label || 'অজানা'} শ্রেণি
                    </p>
                    <p className="text-[10px] text-primary hover:underline truncate max-w-[150px]">
                      {book.fileName}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeBook(book.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed">
            <FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground">কোনো বই পাওয়া যায়নি।</p>
          </Card>
        )}
      </section>
    </div>
  );
}
