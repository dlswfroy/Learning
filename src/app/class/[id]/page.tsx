import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Book, ChevronRight, GraduationCap } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentClass = CLASSES.find(c => c.id === id);
  
  if (!currentClass) {
    notFound();
  }

  const subjects = getSubjectsForClass(id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 border-b pb-4">
        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
          <GraduationCap className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{currentClass.label} শ্রেণির বইসমূহ</h2>
          <p className="text-sm text-muted-foreground">নিচের তালিকা থেকে আপনার পাঠ্যবই নির্বাচন করুন</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((subject, index) => (
          <Link 
            key={index} 
            href={`/class/${id}/${encodeURIComponent(subject)}`}
          >
            <Card className="hover:border-primary hover:shadow-sm transition-all group overflow-hidden cursor-pointer h-full">
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Book className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-semibold">{subject}</CardTitle>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}