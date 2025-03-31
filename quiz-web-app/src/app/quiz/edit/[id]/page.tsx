// app/quiz/edit/[id]/page.tsx
'use client';

import { use } from 'react';
import QuizEditor from '../../create/page';

export default function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params promise using React.use()
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  // This component simply serves as a wrapper for the QuizEditor component
  // The actual edit functionality is handled in the QuizEditor component
  // which checks the URL path to determine if it's in edit mode

  return (
    <QuizEditor />
  );
}