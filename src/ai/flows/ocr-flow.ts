
'use server';
/**
 * @fileOverview A Genkit flow for extracting text from images (OCR) with math support.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OCRInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of educational content, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type OCRInput = z.infer<typeof OCRInputSchema>;

const OCROutputSchema = z.object({
  text: z.string().describe('The extracted and formatted text from the image.'),
});
export type OCROutput = z.infer<typeof OCROutputSchema>;

const ocrPrompt = ai.definePrompt({
  name: 'ocrPrompt',
  input: {schema: OCRInputSchema},
  output: {schema: OCROutputSchema},
  prompt: `You are an expert OCR engine for educational materials. 
Your task is to extract all text from the provided image.

RULES:
1. Preserve the original formatting as much as possible.
2. If you find mathematical formulas, convert them to LaTeX notation. For example, use \\frac{a}{b} for fractions, \\sqrt{x} for square roots, and subscripts/superscripts using _ and ^.
3. If the image contains Bengali text, ensure it is accurately transcribed.
4. Output ONLY the extracted text in the 'text' field. Do not add any conversational preamble.

Photo: {{media url=photoDataUri}}`,
});

export async function performOCR(input: OCRInput): Promise<OCROutput> {
  const {output} = await ocrPrompt(input);
  return output!;
}
