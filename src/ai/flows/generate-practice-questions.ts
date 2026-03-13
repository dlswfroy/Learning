
'use server';
/**
 * @fileOverview A Genkit flow for generating structured board-style questions.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuestionSchema = z.object({
  type: z.enum(['creative', 'short']),
  stimulus: z.string().optional().describe(' উদ্দীপক (উদ্দীপকটি সৃজনশীল প্রশ্নের জন্য)'),
  qA: z.string().optional().describe('জ্ঞানমূলক প্রশ্ন'),
  qB: z.string().optional().describe('অনুধাবনমূলক প্রশ্ন'),
  qC: z.string().optional().describe('প্রয়োগমূলক প্রশ্ন'),
  qD: z.string().optional().describe('উচ্চতর দক্ষতামূলক প্রশ্ন'),
  marksA: z.number().optional().default(1),
  marksB: z.number().optional().default(2),
  marksC: z.number().optional().default(3),
  marksD: z.number().optional().default(4),
  shortText: z.string().optional().describe('সংক্ষিপ্ত প্রশ্ন'),
  shortMarks: z.number().optional().default(5),
});

const GeneratePracticeQuestionsInputSchema = z.object({
  classId: z.string(),
  subject: z.string(),
  type: z.enum(['creative', 'short', 'mixed']).default('mixed'),
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
  prompt: `You are an expert Bangladeshi board examiner.
Generate {{count}} board-standard questions for Class {{classId}} in "{{subject}}".
The question type should be {{type}}.

For creative (সৃজনশীল) questions:
- Provide a high-quality stimulus (উদ্দীপক).
- Provide 4 sub-questions (ক, খ, গ, ঘ) with marks 1, 2, 3, 4 respectively.
- Ensure proper use of mathematical/scientific symbols (e.g., H₂O, √x, x², ±, θ) where applicable.

For short (সংক্ষিপ্ত) questions:
- Provide the question text and assigned marks.

Always output in Bengali language. Ensure the quality matches NCTB curriculum.`,
});

export async function generatePracticeQuestions(input: GeneratePracticeQuestionsInput): Promise<GeneratePracticeQuestionsOutput> {
  const {output} = await generateQuestionsPrompt(input);
  return output!;
}
