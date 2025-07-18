import { useState } from 'react';
import { trpc } from './utils/trpc';
import ReactMarkdown from 'react-markdown';

const Grader = () => {
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [studentSheetFile, setStudentSheetFile] = useState<File | null>(null);

  const gradeMutation = trpc.gradeSheet.useMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'answerKey' | 'studentSheet') => {
    const file = e.target.files?.[0];
    if (file) {
      if (fileType === 'answerKey') {
        setAnswerKeyFile(file);
      } else {
        setStudentSheetFile(file);
      }
    }
  };

  const handleSubmit = async () => {
    if (answerKeyFile && studentSheetFile) {
      const answerKeyPdfBase64 = await toBase64(answerKeyFile);
      const studentSheetPdfBase64 = await toBase64(studentSheetFile);

      gradeMutation.mutate({
        answerKeyPdfBase64: answerKeyPdfBase64 as string,
        studentSheetPdfBase64: studentSheetPdfBase64 as string,
      });
    }
  };

  const toBase64 = (file: File) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });

  return (
    <div>
      <h1>AI PDF Answer Sheet Grader</h1>
      <div>
        <label>Answer Key PDF:</label>
        <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, 'answerKey')} />
      </div>
      <div>
        <label>Student Sheet PDF:</label>
        <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, 'studentSheet')} />
      </div>
      <button onClick={handleSubmit} disabled={!answerKeyFile || !studentSheetFile || gradeMutation.isLoading}>
        {gradeMutation.isLoading ? 'Grading...' : 'Grade'}
      </button>
      {gradeMutation.error && <p>Error: {gradeMutation.error.message}</p>}
      {gradeMutation.data && (
        <div>
          <h2>Grading Report</h2>
          <ReactMarkdown>{gradeMutation.data}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default Grader;
