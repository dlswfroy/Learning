export const CLASSES = [
  { id: '6', label: 'ষষ্ঠ', value: 'sixth' },
  { id: '7', label: 'সপ্তম', value: 'seventh' },
  { id: '8', label: 'অষ্টম', value: 'eighth' },
  { id: '9', label: 'নবম', value: 'ninth' },
  { id: '10', label: 'দশম', value: 'tenth' },
] as const;

export const COMMON_SUBJECTS = [
  'বাংলা ১ম', 'বাংলা ২য়', 'ইংরেজি ১ম', 'ইংরেজি ২য়', 'গণিত', 
  'ইসলাম ধর্ম শিক্ষা', 'হিন্দু ধর্ম শিক্ষা', 'তথ্য ও যোগাযোগ প্রযুক্তি', 
  'কৃষি শিক্ষা', 'বাংলাদেশ ও বিশ্ব পরিচয়', 'বিজ্ঞান'
];

export const HIGHER_SUBJECTS = [
  ...COMMON_SUBJECTS,
  'পদার্থ', 'রসায়ন', 'জীব বিজ্ঞান', 'ইতিহাস ও বিশ্ব সভ্যতা', 
  'ভূগোল ও পরিবেশ', 'পৌরনীতি ও নাগরিকতা', 'উচ্চতর গণিত'
];

export function getSubjectsForClass(classId: string) {
  const num = parseInt(classId);
  if (num >= 9) {
    return HIGHER_SUBJECTS;
  }
  return COMMON_SUBJECTS;
}