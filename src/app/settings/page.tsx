"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, CheckCircle, Trash2, Loader2, Link as LinkIcon, Filter, BookCopy, User, Globe, Save, Camera, FileText, Users, ShieldCheck, FileUp, FileType, ExternalLink } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useUser, useDoc, useStorage } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, getDoc, setDoc, serverTimestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

async function processImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('ফাইল সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না।');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxSide = 512;

        if (width > height) {
          if (width > maxSide) {
            height *= maxSide / width;
            width = maxSide;
          }
        } else {
          if (height > maxSide) {
            width *= maxSide / height;
            height = maxSide;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('ছবি লোড করা সম্ভব হয়নি।'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('ফাইল পড়া সম্ভব হয়নি।'));
    reader.readAsDataURL(file);
  });
}

function naturalSort(a: any, b: any) {
  if (a.classId !== b.classId) return parseInt(a.classId) - parseInt(b.classId);
  if (a.subject !== b.subject) return a.subject.localeCompare(b.subject, 'bn');
  const nameA = a.chapterName || a.fileName || "";
  const nameB = b.chapterName || b.fileName || "";
  return nameA.localeCompare(nameB, 'bn', { numeric: true, sensitivity: 'base' });
}

export default function SettingsPage() {
  const db = useFirestore();
  const storage = useStorage();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  
  const profileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  // Book management states
  const [classId, setClassId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [chapterName, setChapterName] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [bookType, setBookType] = useState<'nctb' | 'guide'>('nctb');
  const [uploading, setUploading] = useState(false);
  
  // Sheet management states
  const [sheetUploadType, setSheetUploadType] = useState<'file' | 'link'>('file');
  const [sheetCategory, setSheetCategory] = useState<string>('');
  const [sheetClassId, setSheetClassId] = useState<string>('');
  const [sheetSubject, setSheetSubject] = useState<string>('');
  const [sheetChapter, setSheetChapter] = useState<string>('');
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [sheetManualUrl, setSheetManualUrl] = useState<string>('');
  const [sheetUploading, setSheetUploading] = useState(false);
  const [sheetUploadProgress, setSheetUploadProgress] = useState(0);

  const [viewClassId, setViewClassId] = useState<string>('all');
  const [viewBookType, setViewBookType] = useState<string>('all');
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const [appName, setAppName] = useState('');
  const [appLogoUrl, setAppLogoUrl] = useState('');
  const [savingSoftware, setSavingSoftware] = useState(false);

  const userProfileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  useEffect(() => {
    if (!userLoading && !user) router.push('/auth');
  }, [user, userLoading, router]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || user?.displayName || '');
      setPhotoURL(userProfile.photoURL || user?.photoURL || '');
    } else if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
    }
  }, [userProfile, user]);

  useEffect(() => {
    if (softwareConfig) {
      setAppName(softwareConfig.appName || 'টপ গ্রেড টিউটোরিয়ালস');
      setAppLogoUrl(softwareConfig.appLogoUrl || '');
    } else {
      setAppName('টপ গ্রেড টিউটোরিয়ালস');
    }
  }, [softwareConfig]);

  useEffect(() => {
    async function checkAdmin() {
      if (!db || !user) return;
      if (user.email === 'dlswf.roy@gmail.com') {
        setIsAdmin(true);
        setAdminCheckLoading(false);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, 'config', 'admin'));
        if (adminDoc.exists() && adminDoc.data().adminUid === user.uid) {
          setIsAdmin(true);
        }
      } catch (e) {} finally {
        setAdminCheckLoading(false);
      }
    }
    if (user && db) checkAdmin();
  }, [user, db]);

  const fetchRequests = async () => {
    if (!isAdmin || !db) return;
    setLoadingRequests(true);
    try {
      const q = query(collection(db, 'users'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {} finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchRequests();
  }, [isAdmin, db]);

  const handleConfirmUser = async (uid: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'users', uid), { 
        status: 'active', 
        updatedAt: serverTimestamp() 
      });
      setPendingUsers(prev => prev.filter(u => u.id !== uid));
      toast({ title: "সফল", description: "ইউজার অ্যাকাউন্ট সক্রিয় করা হয়েছে।" });
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "অনুমোদন ব্যর্থ হয়েছে।" });
    }
  };

  const booksQuery = useMemo(() => db ? collection(db, 'books') : null, [db]);
  const { data: rawBooks, loading: loadingBooks } = useCollection(booksQuery);

  const sheetsQuery = useMemo(() => db ? collection(db, 'pdf-sheets') : null, [db]);
  const { data: rawSheets, loading: loadingSheets } = useCollection(sheetsQuery);

  const sortedBooks = useMemo(() => {
    if (!rawBooks) return [];
    return [...rawBooks].sort(naturalSort);
  }, [rawBooks]);

  const sortedSheets = useMemo(() => {
    if (!rawSheets) return [];
    return [...rawSheets].sort(naturalSort);
  }, [rawSheets]);

  const filteredBooks = useMemo(() => {
    let list = sortedBooks;
    if (viewClassId !== 'all') list = list.filter(b => b.classId === viewClassId);
    if (viewBookType === 'nctb') list = list.filter(b => !b.isGuide);
    else if (viewBookType === 'guide') list = list.filter(b => b.isGuide);
    return list;
  }, [sortedBooks, viewClassId, viewBookType]);

  const subjectsList = useMemo(() => classId ? getSubjectsForClass(classId) : [], [classId]);
  const chaptersList = useMemo(() => (classId && subject) ? getChaptersForSubject(classId, subject) : [], [classId, subject]);

  const sheetSubjectsList = useMemo(() => sheetClassId ? getSubjectsForClass(sheetClassId) : [], [sheetClassId]);
  const sheetChaptersList = useMemo(() => (sheetClassId && sheetSubject) ? getChaptersForSubject(sheetClassId, sheetSubject) : [], [sheetClassId, sheetSubject]);

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await processImage(file);
      setPhotoURL(base64);
      toast({ title: "সফল", description: "ছবি প্রসেস করা হয়েছে। সেভ বাটনে ক্লিক করুন।" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: err.message });
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await processImage(file);
      setAppLogoUrl(base64);
      toast({ title: "সফল", description: "লোগো প্রসেস করা হয়েছে। সেভ বাটনে ক্লিক করুন।" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: err.message });
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !userProfileRef) return;
    setSavingProfile(true);
    const profileData = { 
      displayName: displayName || '', 
      photoURL: photoURL || '', 
      updatedAt: serverTimestamp() 
    };
    try {
      await setDoc(userProfileRef, profileData, { merge: true });
      try {
        await updateProfile(user, { displayName });
      } catch (authErr) {}
      toast({ title: "সফল", description: "প্রোফাইল আপডেট করা হয়েছে।" });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userProfileRef.path, operation: 'write', requestResourceData: profileData
      }));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateSoftware = async () => {
    if (!isAdmin || !db) return;
    setSavingSoftware(true);
    const data = { appName: appName || '', appLogoUrl: appLogoUrl || '' };
    try {
      await setDoc(softwareDocRef, data, { merge: true });
      toast({ title: "সফল", description: "সফটওয়্যার ব্র্যান্ডিং আপডেট করা হয়েছে।" });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: softwareDocRef.path, operation: 'write', requestResourceData: data
      }));
    } finally {
      setSavingSoftware(false);
    }
  };

  const handleSaveBook = async () => {
    if (!classId || !subject || !db || !isAdmin || !pdfUrl) return;
    setUploading(true);
    const bookData = {
      classId, subject, chapterName: bookType === 'guide' ? (chapterName || '') : '',
      fileName: chapterName || subject, pdfUrl: pdfUrl, coverImageUrl: coverImageUrl || '', isGuide: bookType === 'guide',
      uploadedAt: serverTimestamp(), userId: user?.uid || '',
    };
    addDoc(collection(db!, 'books'), bookData)
      .then(() => {
        setUploading(false); setPdfUrl(''); setCoverImageUrl(''); setClassId(''); setSubject(''); setChapterName('');
        toast({ title: "সফল", description: "বইটি যুক্ত করা হয়েছে।" });
      })
      .catch(async () => {
        setUploading(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'books', operation: 'create', requestResourceData: bookData
        }));
      });
  };

  const handleUploadSheet = async () => {
    if (!db || !isAdmin || !sheetCategory || !sheetClassId || !sheetSubject) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "সবগুলো ঘর পূরণ করুন।" });
      return;
    }

    if (sheetUploadType === 'file' && !sheetFile) {
      toast({ variant: "destructive", title: "ফাইল নেই", description: "পিডিএফ ফাইল নির্বাচন করুন।" });
      return;
    }

    if (sheetUploadType === 'link' && !sheetManualUrl) {
      toast({ variant: "destructive", title: "লিঙ্ক নেই", description: "পিডিএফ লিঙ্ক লিখুন।" });
      return;
    }

    setSheetUploading(true);

    if (sheetUploadType === 'link') {
      const sheetData = {
        category: sheetCategory,
        classId: sheetClassId,
        subject: sheetSubject,
        chapterName: sheetChapter || 'সাধারণ',
        fileName: 'PDF Link',
        pdfUrl: sheetManualUrl,
        uploadedAt: serverTimestamp(),
        userId: user?.uid || ''
      };

      try {
        await addDoc(collection(db, 'pdf-sheets'), sheetData);
        toast({ title: "সফল", description: "পিডিএফ লিঙ্কটি যুক্ত করা হয়েছে।" });
        setSheetManualUrl('');
        setSheetChapter('');
      } catch (e) {
        toast({ variant: "destructive", title: "ত্রুটি", description: "সেভ করা সম্ভব হয়নি।" });
      } finally {
        setSheetUploading(false);
      }
      return;
    }

    // Direct File Upload Logic
    if (!storage || !sheetFile) {
      setSheetUploading(false);
      return;
    }

    setSheetUploadProgress(0);
    try {
      const timestamp = Date.now();
      const storagePath = `pdf-sheets/${sheetClassId}/${sheetSubject}/${timestamp}_${sheetFile.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, sheetFile);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setSheetUploadProgress(Math.floor(progress));
        }, 
        (error) => {
          toast({ variant: "destructive", title: "আপলোড ব্যর্থ", description: error.message });
          setSheetUploading(false);
        }, 
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          const sheetData = {
            category: sheetCategory,
            classId: sheetClassId,
            subject: sheetSubject,
            chapterName: sheetChapter || 'সাধারণ',
            fileName: sheetFile.name,
            pdfUrl: downloadUrl,
            uploadedAt: serverTimestamp(),
            userId: user?.uid || ''
          };

          await addDoc(collection(db, 'pdf-sheets'), sheetData);
          toast({ title: "সফল", description: "পিডিএফ শিটটি আপলোড করা হয়েছে।" });
          setSheetUploading(false);
          setSheetFile(null);
          setSheetChapter('');
          if (sheetInputRef.current) sheetInputRef.current.value = '';
        }
      );
    } catch (e: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: e.message });
      setSheetUploading(false);
    }
  };

  const removeBook = (bookId: string) => {
    if (!db || !isAdmin) return;
    if (!confirm("আপনি কি নিশ্চিত?")) return;
    deleteDoc(doc(db, 'books', bookId))
      .then(() => toast({ title: "সফল", description: "বইটি মুছে ফেলা হয়েছে।" }))
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `books/${bookId}`, operation: 'delete'
        }));
      });
  };

  const removeSheet = (sheetId: string) => {
    if (!db || !isAdmin) return;
    if (!confirm("এই শিটটি মুছে ফেলতে চান?")) return;
    deleteDoc(doc(db, 'pdf-sheets', sheetId))
      .then(() => toast({ title: "সফল", description: "শিটটি মুছে ফেলা হয়েছে।" }))
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `pdf-sheets/${sheetId}`, operation: 'delete'
        }));
      });
  };

  if (userLoading || adminCheckLoading) {
    return <div className="flex flex-col items-center justify-center min-h-[50vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10 font-kalpurush">
      <header className="flex items-center gap-4 border-b pb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold">সেটিং</h2>
      </header>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className={`grid w-full mb-6 bg-secondary/50 p-1 ${isAdmin ? 'grid-cols-5' : 'grid-cols-2'}`}>
          <TabsTrigger value="profile" className="gap-2 font-bold text-xs"><User className="w-3.5 h-3.5" /> প্রোফাইল</TabsTrigger>
          <TabsTrigger value="books" className="gap-2 font-bold text-xs"><BookCopy className="w-3.5 h-3.5" /> বই ব্যবস্থাপনা</TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="sheets" className="gap-2 font-bold text-xs"><FileUp className="w-3.5 h-3.5" /> সিট আপলোড</TabsTrigger>
              <TabsTrigger value="requests" className="gap-2 font-bold text-xs"><Users className="w-3.5 h-3.5" /> আবেদন</TabsTrigger>
              <TabsTrigger value="software" className="gap-2 font-bold text-xs"><Globe className="w-3.5 h-3.5" /> ব্র্যান্ডিং</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader className="p-4"><CardTitle className="text-lg">ব্যক্তিগত প্রোফাইল</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative group shrink-0">
                  <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-xl">
                    <AvatarImage src={photoURL || ''} />
                    <AvatarFallback className="text-3xl font-black bg-secondary text-primary">{displayName?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <button onClick={() => profileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-primary text-white p-2 rounded-full shadow-lg">
                    <Camera className="w-4 h-4" />
                  </button>
                  <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={handleProfilePhotoChange} />
                </div>
                <div className="flex-1 w-full space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold">আপনার নাম</Label>
                    <Input value={displayName || ''} onChange={e => setDisplayName(e.target.value)} placeholder="নাম লিখুন" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">প্রোফাইল ছবির লিঙ্ক (ঐচ্ছিক)</Label>
                    <Input value={photoURL || ''} onChange={e => setPhotoURL(e.target.value)} placeholder="https://..." />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t bg-muted/20 py-3">
              <Button onClick={handleUpdateProfile} disabled={savingProfile} className="gap-2 font-bold h-9 shadow-md">
                {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} সেভ করুন
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="books" className="space-y-6">
          {isAdmin && (
            <Card className="border-2 border-primary/10">
              <CardHeader className="p-4 border-b">
                <div className="flex items-center gap-2 font-bold text-primary"><LinkIcon className="w-4 h-4" /> নতুন বই যোগ করুন</div>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                <div className="space-y-3">
                  <Label className="font-bold text-primary">বইয়ের ধরন</Label>
                  <RadioGroup value={bookType || 'nctb'} onValueChange={(v) => setBookType(v as 'nctb' | 'guide')} className="flex gap-6">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="nctb" id="nctb" /><Label htmlFor="nctb" className="cursor-pointer font-bold">পাঠ্যবই</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="guide" id="guide" /><Label htmlFor="guide" className="cursor-pointer font-bold">গাইড বই</Label></div>
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-sm font-bold">শ্রেণি</label><Select onValueChange={setClassId} value={classId || ''}><SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger><SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-sm font-bold">বিষয়</label><Select onValueChange={setSubject} value={subject || ''} disabled={!classId}><SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger><SelectContent>{subjectsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                </div>
                {bookType === 'guide' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold">অধ্যায়ের নাম</label>
                    {chaptersList.length > 0 ? (
                      <Select onValueChange={setChapterName} value={chapterName || ''}><SelectTrigger><SelectValue placeholder="অধ্যায় নির্বাচন করুন" /></SelectTrigger><SelectContent>{chaptersList.map(ch => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}</SelectContent></Select>
                    ) : (
                      <Input placeholder="অধ্যায়ের নাম লিখুন" value={chapterName || ''} onChange={e => setChapterName(e.target.value)} />
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-sm font-bold">পিডিএফ লিঙ্ক</label><Input placeholder="https://..." value={pdfUrl || ''} onChange={e => setPdfUrl(e.target.value)} disabled={uploading} /></div>
                  <div className="space-y-2"><label className="text-sm font-bold">কভার ইমেজ লিঙ্ক (ঐচ্ছিক)</label><Input placeholder="https://..." value={coverImageUrl || ''} onChange={e => setCoverImageUrl(e.target.value)} disabled={uploading} /></div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t bg-muted/20 py-3">
                <Button onClick={handleSaveBook} disabled={uploading || !pdfUrl || !classId || !subject} className="bg-accent text-white h-9 gap-2 px-8 font-bold shadow-lg">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} সেভ করুন
                </Button>
              </CardFooter>
            </Card>
          )}

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="font-bold">বর্তমানে থাকা বইসমূহ</h3>
              <div className="flex items-center gap-2 bg-secondary/30 p-1.5 rounded-lg border">
                <Select value={viewClassId || 'all'} onValueChange={setViewClassId}>
                  <SelectTrigger className="w-[110px] h-8 text-[10px] bg-white font-bold"><SelectValue placeholder="সব শ্রেণি" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">সব শ্রেণি</SelectItem>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent>
                </Select>
                <Select value={viewBookType || 'all'} onValueChange={setViewBookType}>
                  <SelectTrigger className="w-[110px] h-8 text-[10px] bg-white font-bold"><SelectValue placeholder="বইয়ের ধরন" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">সব বই</SelectItem><SelectItem value="nctb">পাঠ্যবই</SelectItem><SelectItem value="guide">গাইড বই</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {loadingBooks ? (
              <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></div>
            ) : filteredBooks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredBooks.map(book => (
                  <div key={book.id} className="p-3 flex items-center justify-between border rounded-lg hover:border-primary transition-all group bg-white shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 rounded border bg-primary/5 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {book.coverImageUrl ? <img src={book.coverImageUrl} className="w-full h-full object-cover" /> : <FileText className="w-5 h-5 text-primary" />}
                        {book.isGuide && <div className="absolute top-0 right-0 bg-accent text-[6px] px-1 text-white font-bold uppercase">Guide</div>}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate text-primary">{book.subject}</h4>
                        <p className="text-[10px] text-muted-foreground font-bold">{CLASSES.find(c => c.id === book.classId)?.label || 'অজানা'} শ্রেণি | {book.isGuide ? 'গাইড' : 'বোর্ড'}</p>
                      </div>
                    </div>
                    {isAdmin && <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeBook(book.id)}><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center border-dashed border-2 bg-muted/5 rounded-xl"><p className="text-muted-foreground text-sm">কোনো বই পাওয়া যায়নি।</p></div>
            )}
          </div>
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="sheets" className="space-y-6">
              <Card className="border-2 border-indigo-100">
                <CardHeader className="bg-indigo-50/50 p-4 border-b">
                  <CardTitle className="text-lg flex items-center gap-2 font-bold text-indigo-700">
                    <FileType className="w-5 h-5" /> পিডিএফ সিট আপলোড
                  </CardTitle>
                  <CardDescription className="font-bold">লেকচার শিট, সৃজনশীল প্রশ্ন, এমসিকিউ বা মডেল টেস্ট পিডিএফ আপলোড করুন।</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                  <div className="space-y-4 border-b pb-4">
                    <Label className="font-bold text-indigo-700">আপলোড পদ্ধতি</Label>
                    <RadioGroup value={sheetUploadType} onValueChange={(v) => setSheetUploadType(v as 'file' | 'link')} className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="file" id="sheet-file" />
                        <Label htmlFor="sheet-file" className="cursor-pointer font-bold text-xs">ফাইল আপলোড</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="link" id="sheet-link" />
                        <Label htmlFor="sheet-link" className="cursor-pointer font-bold text-xs">লিঙ্ক আপলোড (URL)</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">ক্যাটাগরি</label>
                      <Select onValueChange={setSheetCategory} value={sheetCategory || ''}>
                        <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lecture_sheet">লেকচার শিট</SelectItem>
                          <SelectItem value="creative">সৃজনশীল প্রশ্ন</SelectItem>
                          <SelectItem value="mcq">বহুনির্বাচনী প্রশ্ন</SelectItem>
                          <SelectItem value="model_test">মডেল টেস্ট</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">শ্রেণি</label>
                      <Select onValueChange={setSheetClassId} value={sheetClassId || ''}>
                        <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">বিষয়</label>
                      <Select onValueChange={setSheetSubject} value={sheetSubject || ''} disabled={!sheetClassId}>
                        <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>{sheetSubjectsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">অধ্যায় (Chapter)</label>
                      {sheetChaptersList.length > 0 ? (
                        <Select onValueChange={setSheetChapter} value={sheetChapter || ''}>
                          <SelectTrigger><SelectValue placeholder="অধ্যায় নির্বাচন করুন" /></SelectTrigger>
                          <SelectContent>{sheetChaptersList.map(ch => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input placeholder="অধ্যায়ের নাম লিখুন" value={sheetChapter || ''} onChange={e => setSheetChapter(e.target.value)} />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {sheetUploadType === 'file' ? (
                      <>
                        <label className="text-sm font-bold">পিডিএফ ফাইল নির্বাচন করুন</label>
                        <div className="flex items-center gap-4">
                          <Input 
                            type="file" 
                            ref={sheetInputRef}
                            accept="application/pdf" 
                            onChange={e => setSheetFile(e.target.files?.[0] || null)} 
                            className="flex-1 font-bold"
                            disabled={sheetUploading}
                          />
                          {sheetFile && (
                            <Button variant="ghost" onClick={() => { setSheetFile(null); if(sheetInputRef.current) sheetInputRef.current.value = ''; }} className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {sheetUploading && (
                          <div className="space-y-2 mt-2">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span>আপলোড হচ্ছে...</span>
                              <span>{sheetUploadProgress}%</span>
                            </div>
                            <Progress value={sheetUploadProgress} className="h-2" />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <label className="text-sm font-bold">পিডিএফ লিঙ্ক (URL) দিন</label>
                        <Input 
                          placeholder="https://example.com/sheet.pdf" 
                          value={sheetManualUrl} 
                          onChange={e => setSheetManualUrl(e.target.value)} 
                          className="font-bold"
                          disabled={sheetUploading}
                        />
                      </>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t bg-muted/20 py-3">
                  <Button onClick={handleUploadSheet} disabled={sheetUploading || (sheetUploadType === 'file' && !sheetFile) || (sheetUploadType === 'link' && !sheetManualUrl)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 gap-2 px-10 font-bold shadow-lg">
                    {sheetUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} {sheetUploadType === 'file' ? 'সিট আপলোড করুন' : 'লিঙ্ক সেভ করুন'}
                  </Button>
                </CardFooter>
              </Card>

              <div className="space-y-4 pt-6">
                <h3 className="font-bold flex items-center gap-2 text-indigo-700"><CheckCircle className="w-4 h-4" /> আপলোড করা সিটসমূহ</h3>
                {loadingSheets ? (
                  <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" /></div>
                ) : sortedSheets.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {sortedSheets.map(sheet => (
                      <div key={sheet.id} className="p-4 border rounded-xl flex items-center justify-between bg-white hover:bg-indigo-50/30 transition-all shadow-sm group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-indigo-900">{sheet.chapterName} - {sheet.subject}</h4>
                            <div className="flex gap-2 items-center mt-0.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                                {sheet.category === 'lecture_sheet' ? 'লেকচার শিট' : sheet.category === 'creative' ? 'সৃজনশীল' : sheet.category === 'mcq' ? 'এমসিকিউ' : 'মডেল টেস্ট'}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-bold">
                                {CLASSES.find(c => c.id === sheet.classId)?.label} শ্রেণি
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={sheet.pdfUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-8 font-bold gap-1 text-[10px] border-indigo-200">
                              <LinkIcon className="w-3 h-3" /> ফাইল দেখুন
                            </Button>
                          </a>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeSheet(sheet.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center border-dashed border-2 bg-muted/5 rounded-xl"><p className="text-muted-foreground text-sm font-bold">কোনো সিট পাওয়া যায়নি।</p></div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="requests" className="space-y-6">
              <Card className="border-2 border-orange-100">
                <CardHeader className="bg-orange-50/50 p-4 border-b">
                  <CardTitle className="text-lg flex items-center gap-2 font-bold text-orange-700">
                    <Users className="w-5 h-5" /> একাউন্ট খোলার আবেদনসমূহ
                  </CardTitle>
                  <CardDescription className="font-bold">যেসকল ইউজার রেজিস্ট্রেশন করেছেন তাদের তালিকা এখানে পাবেন।</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {loadingRequests ? (
                    <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto" /></div>
                  ) : pendingUsers.length > 0 ? (
                    <div className="space-y-3">
                      {pendingUsers.map(userReq => (
                        <div key={userReq.id} className="p-4 border rounded-xl flex items-center justify-between bg-white hover:bg-slate-50 transition-all shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-black">
                              {userReq.displayName?.charAt(0) || userReq.email?.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-sm">{userReq.displayName || 'নামহীন'}</h4>
                              <p className="text-xs text-muted-foreground font-bold">{userReq.email}</p>
                            </div>
                          </div>
                          <Button 
                            onClick={() => handleConfirmUser(userReq.id)} 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 gap-2 font-bold"
                          >
                            <ShieldCheck className="w-4 h-4" /> কনফার্ম করুন
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-20 text-center border-dashed border-2 bg-muted/5 rounded-2xl">
                      <p className="text-muted-foreground font-bold">বর্তমানে কোনো পেন্ডিং আবেদন নেই।</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="software" className="space-y-6">
              <Card className="border-2 border-primary/20">
                <CardHeader className="p-4"><CardTitle className="text-lg font-black text-primary">সফটওয়্যার ব্র্যান্ডিং</CardTitle></CardHeader>
                <CardContent className="p-4 space-y-8">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative group shrink-0">
                      <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center p-2 border-4 border-primary/10 overflow-hidden shadow-xl">
                        {appLogoUrl ? <img src={appLogoUrl} className="max-w-full max-h-full object-contain" /> : <Globe className="w-10 h-10 text-primary" />}
                      </div>
                      <button onClick={() => logoInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-accent text-white p-2 rounded-full shadow-lg">
                        <Camera className="w-4 h-4" />
                      </button>
                      <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                    </div>
                    <div className="flex-1 w-full space-y-4">
                      <div className="space-y-2">
                        <Label className="font-bold">সফটওয়্যারের নাম</Label>
                        <Input value={appName || ''} onChange={e => setAppName(e.target.value)} placeholder="প্রতিষ্ঠানের নাম লিখুন" className="font-bold text-primary text-[25px]" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold">লোগো ছবি লিঙ্ক (ঐচ্ছিক)</Label>
                        <Input value={appLogoUrl || ''} onChange={e => setAppLogoUrl(e.target.value)} placeholder="https://..." />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t bg-muted/20 py-3">
                  <Button onClick={handleUpdateSoftware} disabled={savingSoftware} className="gap-2 font-bold h-9 shadow-lg bg-primary">
                    {savingSoftware ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} সেভ করুন
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
