import { CLASSES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, HelpCircle, FileText, Download } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function SubjectPage({ 
  params 
}: { 
  params: Promise<{ id: string, subject: string }> 
}) {
  const { id, subject: encodedSubject } = await params;
  const subject = decodeURIComponent(encodedSubject);
  const currentClass = CLASSES.find(c => c.id === id);
  
  if (!currentClass) {
    notFound();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/class/${id}`} className="p-2 hover:bg-secondary rounded-full transition-colors">
            <BookOpen className="w-6 h-6 text-primary" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{subject}</h2>
            <p className="text-sm text-muted-foreground">{currentClass.label} শ্রেণি</p>
          </div>
        </div>
        <Link href={`/create-question?classId=${id}&subject=${encodeURIComponent(subject)}`}>
          <Button className="w-full md:w-auto gap-2 shadow-sm">
            <HelpCircle className="w-4 h-4" />
            AI প্রশ্ন তৈরি করুন
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="read" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="read" className="gap-2">
            <FileText className="w-4 h-4" />
            বই পড়ুন
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2">
            <Download className="w-4 h-4" />
            রিসোর্স
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="read">
          <Card className="border-2 border-dashed border-primary/20 bg-primary/5 min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-primary mb-6 shadow-sm">
              <BookOpen className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold mb-2">ডিজিটাল পাঠ্যবই</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              দুঃখিত, এই মুহূর্তের জন্য এই বইটির PDF কপি সিস্টেমে নেই। আপনি সেটিং থেকে বইটি আপলোড করতে পারেন।
            </p>
            <Link href="/settings">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                বই আপলোড করুন
              </Button>
            </Link>
          </Card>
        </TabsContent>
        
        <TabsContent value="resources">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">অধ্যায় ভিত্তিক নোট</CardTitle>
                <CardDescription>গুরুত্বপূর্ণ টপিক সমূহের সারসংক্ষেপ</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" className="w-full" disabled>ডাউনলোড করুন</Button>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">বিগত বছরের প্রশ্ন</CardTitle>
                <CardDescription>বোর্ড পরীক্ষার প্রশ্নপত্র</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" className="w-full" disabled>ডাউনলোড করুন</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}