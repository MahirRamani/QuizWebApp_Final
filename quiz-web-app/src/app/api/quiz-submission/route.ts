// app/api/quiz-submission/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Define interfaces for type safety
interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  id: string;
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'MULTIPLE_CORRECT';
  options: QuizOption[];
  marks?: number;
  timeLimit?: number;
}

interface Quiz {
  _id: ObjectId;
  title: string;
  questions: QuizQuestion[];
}

interface QuizAnswers {
  [questionId: string]: string[];
}

export async function POST(request: NextRequest) {
  console.log("ghg");
  try {
    const { db } = await connectToDatabase();
    ;
    const { quizId, studentName, answers, focusLossCount,submissionReason, timeUsed } = await request.json() as {
      quizId: string;
      studentName: string;
      answers: QuizAnswers;
      submissionReason : string;
      focusLossCount: number;
      timeUsed: number;
    };

    console.log("focusLossCount", focusLossCount);
    
    
    
    // Fetch quiz data to calculate score
    const quiz = await db.collection('quizzes').findOne({ _id: new ObjectId(quizId) }) as Quiz | null;
    
    if (!quiz) {
      return NextResponse.json(
        { error: 'Quiz not found' },
        { status: 404 }
      );
    }

    // Calculate score and prepare question results
    let score = 0;
    let correctAnswers = 0;
    const questionResults = [];

    for (const question of quiz.questions) {
      const studentAnswer = answers[question.id] || [];
      const correctAnswer = question.options
        .filter((opt: QuizOption) => opt.isCorrect)
        .map((opt: QuizOption) => opt.text);
      
      // Simple checking logic - can be more complex based on question type
      const isCorrect = compareAnswers(studentAnswer, question);
      
      if (isCorrect) {
        score += question.marks || 1; // Default to 1 point if marks not specified
        correctAnswers++;
      }

      questionResults.push({
        questionId: question.id,
        questionText: question.text,
        isCorrect,
        studentAnswer: studentAnswer.map((answerId: string) => {
          const option = question.options.find((opt: QuizOption) => opt.id === answerId);
          return option ? option.text : 'Unknown option';
        }),
        correctAnswer: correctAnswer,
        timeSpent: question.timeLimit || 30 // This is an approximation - would need actual time tracking
      });
    }

    // Calculate total possible points
    const totalPoints = quiz.questions.reduce((sum: number, q: QuizQuestion) => sum + (q.marks || 1), 0);

    // Create submission record
    const submission = {
      quizId,
      quizTitle: quiz.title,
      studentName,
      score,
      totalPoints,
      correctAnswers,
      totalQuestions: quiz.questions.length,
      timeUsed,
      focusLossCount,
      submittedAt: new Date(),
      questionResults
    };

    // Save submission to database
    const result = await db.collection('quiz_submissions').insertOne(submission);

    return NextResponse.json({
      _id: result.insertedId,
      ...submission
    });
  } catch (error) {
    console.error('Failed to submit quiz:', error);
    return NextResponse.json(
      { error: 'Failed to submit quiz' },
      { status: 500 }
    );
  }
}

// Helper function to compare student answers with correct answers
function compareAnswers(studentAnswerIds: string[], question: QuizQuestion): boolean {
  if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
    // For single-answer questions, check if the student selected the one correct option
    const correctOptionId = question.options.find((opt: QuizOption) => opt.isCorrect)?.id;
    return studentAnswerIds.length === 1 && studentAnswerIds[0] === correctOptionId;
  } 
  else if (question.type === 'MULTIPLE_CORRECT') {
    // For multiple-answer questions, check if student selected all correct options and no incorrect ones
    const correctOptionIds = question.options
      .filter((opt: QuizOption) => opt.isCorrect)
      .map((opt: QuizOption) => opt.id);
    
    // Check if arrays have the same elements (regardless of order)
    return (
      correctOptionIds.length === studentAnswerIds.length &&
      correctOptionIds.every((id: string) => studentAnswerIds.includes(id))
    );
  }
  
  // Default case
  return false;
}