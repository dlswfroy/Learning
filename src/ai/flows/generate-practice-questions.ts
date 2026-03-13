'use server';
/**
 * @fileOverview A Genkit flow for generating practice questions for a given class and subject.
 *
 * - generatePracticeQuestions - A function that handles the practice question generation process.
 * - GeneratePracticeQuestionsInput - The input type for the generatePracticeQuestions function.
 * - GeneratePracticeQuestionsOutput - The return type for the generatePracticeQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema
const GeneratePracticeQuestionsInputSchema = z.object({
  classId: z.string().describe('The ID of the class (e.g., "sixth", "seventh").'),
  subject: z.string().describe('The name of the subject (e.g., "বাংলা ১ম", "গণিত").'),
  numberOfQuestions: z.number().int().positive().optional().default(5).describe('The number of practice questions to generate.'),
});
export type GeneratePracticeQuestionsInput = z.infer<typeof GeneratePracticeQuestionsInputSchema>;

// Output schema
const GeneratePracticeQuestionsOutputSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe('The generated practice question text.'),
      answer: z.string().describe('The correct answer to the practice question.'),
    })
  ).describe('A list of generated practice questions with their answers.'),
});
export type GeneratePracticeQuestionsOutput = z.infer<typeof GeneratePracticeQuestionsOutputSchema>;

// Prompt definition
const generateQuestionsPrompt = ai.definePrompt({
  name: 'generateQuestionsPrompt',
  input: {schema: GeneratePracticeQuestionsInputSchema},
  output: {schema: GeneratePracticeQuestionsOutputSchema},
  prompt: `You are an expert educator. Your task is to create practice questions for students based on their class and subject.
Generate exactly {{numberOfQuestions}} practice questions for Class {{classId}} in the subject "{{subject}}".
Each question should be relevant to the curriculum typically covered in that class and subject. Provide the correct answer for each question.

Output your response as a JSON array of objects, where each object has a 'question' field for the question text and an 'answer' field for the correct answer.

Example format:
{
  "questions": [
    {
      "question": "What is 2+2?",
      "answer": "4"
    },
    {
      "question": "What is the capital of France?",
      "answer": "Paris"
    }
  ]
}`,
});

// Flow definition
const generatePracticeQuestionsFlow = ai.defineFlow(
  {
    name: 'generatePracticeQuestionsFlow',
    inputSchema: GeneratePracticeQuestionsInputSchema,
    outputSchema: GeneratePracticeQuestionsOutputSchema,
  },
  async (input) => {
    const {output} = await generateQuestionsPrompt(input);
    return output!;
  }
);

// Wrapper function
export async function generatePracticeQuestions(input: GeneratePracticeQuestionsInput): Promise<GeneratePracticeQuestionsOutput> {
  return generatePracticeQuestionsFlow(input);
}
