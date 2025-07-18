import { t } from './trpc';
import { z } from 'zod';
import { Vision } from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdf from 'pdf-poppler';
import fs from 'fs';
import path from 'path';

const visionClient = new Vision();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const appRouter = t.router({
  gradeSheet: t.procedure
    .input(
      z.object({
        answerKeyPdfBase64: z.string(),
        studentSheetPdfBase64: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { answerKeyPdfBase64, studentSheetPdfBase64 } = input;

      const answerKeyPdfBuffer = Buffer.from(answerKeyPdfBase64, 'base64');
      const studentSheetPdfBuffer = Buffer.from(studentSheetPdfBase64, 'base64');

      const answerKeyImagePath = path.join(__dirname, 'answerKey.png');
      const studentSheetImagePath = path.join(__dirname, 'studentSheet.png');

      await pdf.convert(answerKeyPdfBuffer, {
        format: 'png',
        out_dir: __dirname,
        out_prefix: 'answerKey',
        page: 1,
      });

      await pdf.convert(studentSheetPdfBuffer, {
        format: 'png',
        out_dir: __dirname,
        out_prefix: 'studentSheet',
        page: 1,
      });

      const [answerKeyTextResult] = await visionClient.documentTextDetection(
        answerKeyImagePath
      );
      const answerKeyText = answerKeyTextResult.fullTextAnnotation?.text;

      const [studentSheetTextResult] = await visionClient.documentTextDetection(
        studentSheetImagePath
      );
      const studentSheetText = studentSheetTextResult.fullTextAnnotation?.text;

      fs.unlinkSync(answerKeyImagePath);
      fs.unlinkSync(studentSheetImagePath);

      const prompt = `You are an expert and meticulous AI English Teacher's Assistant. Your task is to grade a student's handwritten answer sheet by comparing it against a teacher's provided answer key.

Here is the text extracted from the teacher's Answer Key:
---
${answerKeyText}
---

Here is the text extracted from the Student's Answer Sheet:
---
${studentSheetText}
---

Please perform the following actions:
1.  First, analyze both texts to identify the individual questions and their corresponding answers. Assume the documents follow a logical question-and-answer format.
2.  For each question, compare the student's answer to the model answer from the key based on semantic meaning and key concepts, not just exact keyword matching.
3.  Assume each question is worth 10 points for this evaluation.
4.  Generate a final report in Markdown format. For each question, provide a score and brief, constructive feedback.

Your final output **must** be only the Markdown report, structured exactly like this example:

### Question 1
**Score:** 8/10
**Feedback:** The student correctly identified the main theme but missed mentioning the secondary character's motivation, which was a key part of the model answer.

### Question 2
**Score:** 10/10
**Feedback:** Excellent. The answer is comprehensive and aligns perfectly with the model answer.
`;

      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return text;
    }),
});

export type AppRouter = typeof appRouter;
