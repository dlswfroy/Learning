
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Upload, FileText, CheckCircle, Trash2, Loader2, Link as LinkIcon, Filter, BookCopy } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useStorage, useUser } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

function naturalSort(a: any, b: any) {
  if (a.classId !== b.classId) return parseInt(a.classId) - parseInt(b.classId);
  if (a.subject !== b.subject) return a.subject.localeCompare(b.subject, 'bn');
  if (a.isGuide !== b.isGuide) return a.isGuide ? 1 : -1;
  
  const nameA = a.chapterName || a.fileName || "";
  const nameB = b.chapterName || b.fileName || "";
  // Use numeric sorting for chapters like "গদ্য-১", "গদ্য-১০"
  return nameA.localeCompare(nameB, 'bn', { numeric: true, sensitivity: 'base' });
}

export default function SettingsPage() {
  const db = useFirestore();
  const storage = useStorage();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  
  const [classId, setClassId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [chapterName, setChapterName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [bookType, setBookType] = useState<'nctb' | 'guide'>('nctb');
  
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'link'>('file');
  
  const [viewClassId, setViewClassId] = useState<string>('all');
  const [viewBookType, setViewBookType] = useState<string>('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/auth');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    async function checkAdmin() {
      if (!db || !user) return;
      try {
        const adminDoc = await getDoc(doc(db, 'config', 'admin'));
        if (adminDoc.exists() && adminDoc.data().adminUid === user.uid) {
          setIsAdmin(true);
        }
      } catch (e) {
        // Silently fail if admin check fails
      } finally {
        setAdminCheckLoading(false);
      }
    }
    if (user && db) checkAdmin();
  }, [user, db]);

  const booksQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'books');
  }, [db]);

  const { data: rawBooks, loading: loadingBooks } = useCollection(booksQuery);

  const sortedBooks = useMemo(() => {
    if (!rawBooks) return [];
    return [...rawBooks].sort(naturalSort);
  }, [rawBooks]);

  const filteredBooks = useMemo(() => {
    let list = sortedBooks;
    if (viewClassId !== 'all') {
      list = list.filter(b => b.classId === viewClassId);
    }
    if (viewBookType === 'nctb') {
      list = list.filter(b => !b.isGuide);
    } else if (viewBookType === 'guide') {
      list = list.filter(b => b.isGuide);
    }
    return list;
  }, [sortedBooks, viewClassId, viewBookType]);

  const subjectsList = useMemo(() => classId ? getSubjectsForClass(classId) : [], [classId]);
  const chaptersList = useMemo(() => (classId && subject) ? getChaptersForSubject(classId, subject) : [], [classId, subject]);

  const handleSaveBook = async () => {
    if (!classId || !subject || !db || !isAdmin) return;

    if (uploadMethod === 'file') {
      if (!file || !storage) return;
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
            toast({ title: "আপলোড ব্যর্থ", variant: "destructive" });
          },
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            saveToFirestore(downloadUrl, file.name);
          }
        );
      } catch (error: any) {
        setUploading(false);
      }
    } else {
      if (!pdfUrl) return;
      setUploading(true);
      saveToFirestore(pdfUrl, chapterName || subject);
    }
  };

  const saveToFirestore = (url: string, fileName: string) => {
    const bookData = {
      classId: classId,
      subject: subject,
      chapterName: bookType === 'guide' ? (chapterName || '') : '',
      fileName: fileName,
      pdfUrl: url,
      coverImageUrl: coverImageUrl || '',
      isGuide: bookType === 'guide',
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
        setChapterName('');
        setProgress(0);
        toast({ title: "সফল", description: "বইটি যুক্ত করা হয়েছে।" });
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
    if (!db || !isAdmin) return;
    if (!confirm("আপনি কি নিশ্চিত?")) return;
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

  if (userLoading || adminCheckLoading) {
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

      {isAdmin && (
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
            <CardContent className="pt-4 space-y-6">
              <div className="space-y-3">
                <Label className="font-bold text-primary">বইয়ের ধরন</Label>
                <RadioGroup value={bookType || 'nctb'} onValueChange={(v) => setBookType(v as 'nctb' | 'guide')} className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nctb" id="nctb" />
                    <Label htmlFor="nctb" className="cursor-pointer">পাঠ্যবই (NCTB)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="guide" id="guide" />
                    <Label htmlFor="guide" className="cursor-pointer">গাইড বই</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">শ্রেণি</label>
                  <Select onValueChange={setClassId} value={classId || ''}>
                    <SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectsList.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {bookType === 'guide' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">অধ্যায়ের নাম</label>
                  {chaptersList.length > 0 ? (
                    <Select onValueChange={setChapterName} value={chapterName || ''}>
                      <SelectTrigger>
                        <SelectValue placeholder="অধ্যায় নির্বাচন করুন" />
                      </SelectTrigger>
                      <SelectContent>
                        {chaptersList.map((ch) => (
                          <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      placeholder="অধ্যায়ের নাম লিখুন" 
                      value={chapterName || ''} 
                      onChange={(e) => setChapterName(e.target.value)}
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">{uploadMethod === 'file' ? 'PDF ফাইল' : 'ডাউনলোড লিঙ্ক'}</label>
                  {uploadMethod === 'file' ? (
                    <Input 
                      type="file" 
                      accept=".pdf" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                    />
                  ) : (
                    <Input 
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
          <div className="flex flex-wrap items-center gap-2 bg-secondary/30 p-1.5 rounded-lg border">
            <Filter className="w-4 h-4 text-muted-foreground ml-2" />
            <Select value={viewClassId || 'all'} onValueChange={setViewClassId}>
              <SelectTrigger className="w-[120px] h-8 text-xs bg-white">
                <SelectValue placeholder="সব শ্রেণি" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব শ্রেণি</SelectItem>
                {CLASSES.map((c) => (
                  <SelectItem key={`filter-opt-${c.id}`} value={c.id}>{c.label} শ্রেণি</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={viewBookType || 'all'} onValueChange={setViewBookType}>
              <SelectTrigger className="w-[120px] h-8 text-xs bg-white">
                <SelectValue placeholder="বইয়ের ধরন" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব বই</SelectItem>
                <SelectItem value="nctb">বোর্ড বই</SelectItem>
                <SelectItem value="guide">গাইড বই</SelectItem>
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
                  <div className="w-12 h-16 rounded border bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 relative">
                    {book.coverImageUrl ? (
                      <img src={book.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-6 h-6 text-primary" />
                    )}
                    {book.isGuide && (
                      <div className="absolute top-0 right-0 bg-accent text-[8px] px-1 text-white font-bold">GUIDE</div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-1">
                      {book.subject}
                      {book.isGuide && <BookCopy className="w-3 h-3 text-accent" />}
                    </h4>
                    <p className="text-[10px] text-muted-foreground">
                      {CLASSES.find(c => c.id === book.classId)?.label || 'অজানা'} শ্রেণি | {book.isGuide ? 'গাইড বই' : 'পাঠ্যবই'}
                    </p>
                    {book.chapterName && (
                      <p className="text-[10px] font-bold text-accent">{book.chapterName}</p>
                    )}
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
