
'use server';
/**
 * @fileOverview A Genkit flow for generating structured board-style questions (Written and MCQ).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuestionSchema = z.object({
  type: z.enum(['creative', 'short', 'mcq']),
  // Written fields
  stimulus: z.string().optional().describe('উদ্দীপক (সৃজনশীল প্রশ্নের জন্য)'),
  qA: z.string().optional().describe('জ্ঞানমূলক প্রশ্ন (ক)'),
  qB: z.string().optional().describe('অনুধাবনমূলক প্রশ্ন (খ)'),
  qC: z.string().optional().describe('প্রয়োগমূলক প্রশ্ন (গ)'),
  qD: z.string().optional().describe('উচ্চতর দক্ষতামূলক প্রশ্ন (ঘ)'),
  shortText: z.string().optional().describe('সংক্ষিপ্ত প্রশ্ন'),
  // MCQ fields
  mcqQuestion: z.string().optional().describe('বহুনির্বাচনি প্রশ্ন'),
  optA: z.string().optional().describe('অপশন ক'),
  optB: z.string().optional().describe('অপশন খ'),
  optC: z.string().optional().describe('অপশন গ'),
  optD: z.string().optional().describe('অপশন ঘ'),
  correctOpt: z.string().optional().describe('সঠিক উত্তর (ক/খ/গ/ঘ)'),
});

const GeneratePracticeQuestionsInputSchema = z.object({
  classId: z.string(),
  subject: z.string(),
  type: z.enum(['creative', 'short', 'mcq', 'mixed']).default('mixed'),
  count: z.number().optional().default(3),
});
export type GeneratePracticeQuestionsInput = z.infer<typeof GeneratePracticeQuestionsInputSchema>;

const GeneratePracticeQuestionsOutputSchema = z.object({
  questions: z.array(QuestionSchema),
});
export type GeneratePracticeQuestionsOutput = z.infer<typeof GeneratePracticeQuestionsOutputSchema>;

const generateQuestionsPrompt = ai.definePrompt({
  name: 'generateQuestionsPrompt',
  input: {schema: GeneratePracticeQuestionsInputSchema},
  output: {schema: GeneratePracticeQuestionsOutputSchema},
  prompt: `You are an expert Bangladeshi board examiner for NCTB curriculum.
Generate {{count}} board-standard questions for Class {{classId}} in "{{subject}}".
The question type should be {{type}}.

RULES:
1. For creative (সৃজনশীল) questions:
   - Provide a high-quality stimulus (উদ্দীপক).
   - Provide 4 sub-questions (ক, খ, গ, ঘ).
2. For short (সংক্ষিপ্ত) questions:
   - Provide only the question text in shortText field.
3. For mcq (বহুনির্বাচনি) questions:
   - Provide the question in mcqQuestion.
   - Provide 4 distinct options (optA, optB, optC, optD).
   - Indicate the correct option (correctOpt) as 'ক', 'খ', 'গ', or 'ঘ'.
4. Ensure proper use of mathematical/scientific symbols (e.g., H₂O, √x, x², ±, θ) where applicable.
5. ALWAYS output in Bengali language. Ensure the quality matches board standards.`,
});

export async function generatePracticeQuestions(input: GeneratePracticeQuestionsInput): Promise<GeneratePracticeQuestionsOutput> {
  const {output} = await generateQuestionsPrompt(input);
  return output!;
}
