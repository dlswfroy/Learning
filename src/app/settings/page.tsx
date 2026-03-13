"use client";

import { useState } from 'react';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Settings, Upload, FileText, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedBooks, setUploadedBooks] = useState<any[]>([]);

  const subjects = classId ? getSubjectsForClass(classId) : [];

  const handleUpload = () => {
    if (!classId || !subject || !file) {
      toast({
        title: "তথ্য অসম্পূর্ণ",
        description: "শ্রেণি, বিষয় এবং ফাইল নির্বাচন করুন।",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    // Simulate upload
    setTimeout(() => {
      const newBook = {
        id: Math.random().toString(36).substr(2, 9),
        className: CLASSES.find(c => c.id === classId)?.label,
        subject,
        fileName: file.name,
      };
      setUploadedBooks([newBook, ...uploadedBooks]);
      setUploading(false);
      setFile(null);
      toast({
        title: "আপলোড সফল",
        description: `${subject} বইটি ${newBook.className} শ্রেণিতে যুক্ত হয়েছে।`,
      });
    }, 1500);
  };

  const removeBook = (id: string) => {
    setUploadedBooks(uploadedBooks.filter(b => b.id !== id));
    toast({ title: "বই অপসারিত", description: "বইটি আপনার তালিকা থেকে মুছে ফেলা হয়েছে।" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      <header className="flex items-center gap-4 border-b pb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
          <Settings className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">সেটিং</h2>
          <p className="text-sm text-muted-foreground">সফটওয়্যার কনফিগারেশন এবং নতুন কন্টেন্ট যোগ করুন</p>
        </div>
      </header>

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-primary flex items-center gap-2">
          <Upload className="w-5 h-5" />
          নতুন বই যোগ করুন (PDF)
        </h3>
        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">শ্রেণি</label>
              <Select onValueChange={setClassId} value={classId}>
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
              <Select onValueChange={setSubject} value={subject} disabled={!classId}>
                <SelectTrigger>
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
              <label className="text-sm font-semibold">PDF ফাইল নির্বাচন করুন</label>
              <Input 
                type="file" 
                accept=".pdf" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t py-4">
            <Button onClick={handleUpload} disabled={uploading || !file} className="gap-2 bg-accent hover:bg-accent/90">
              {uploading ? 'আপলোড হচ্ছে...' : 'বই সেভ করুন'}
              <CheckCircle className="w-4 h-4" />
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-foreground">আপনার আপলোড করা বইসমূহ</h3>
        {uploadedBooks.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 bg-secondary/20">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">কোনো বই আপলোড করা হয়নি।</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {uploadedBooks.map((book) => (
              <Card key={book.id} className="p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold">{book.subject} - {book.className} শ্রেণি</h4>
                    <p className="text-xs text-muted-foreground italic">{book.fileName}</p>
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