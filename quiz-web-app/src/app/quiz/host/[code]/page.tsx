// app/quiz/host/[code]/page.tsx
'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Participant {
  _id: string;
  name: string;
  score: number;
} 

interface Question {
  _id: string;
  text: string;
  options: {
    _id: string;
    text: string;
    isCorrect: boolean;
  }[];
  timeLimit: number;
  type: 'MCQ' | 'TRUE_FALSE' | 'MULTIPLE_CORRECT';
}

interface Quiz {
  _id: string;
  title: string;
  questions: Question[];
}

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function QuizHostPage({ params }: PageProps) {
  const { code } = use(params);
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [status, setStatus] = useState<'waiting' | 'active' | 'completed'>('waiting');
  const [leaderboard, setLeaderboard] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    // Host connects to the quiz
    newSocket.emit('host-join', { joinCode: code });

    // Socket event listeners
    newSocket.on('host-connected', ({ quiz, sessionId }) => {
      setQuiz(quiz);
      setSessionId(sessionId);
    });

    newSocket.on('participant-joined', ({ participants }) => {
      setParticipants(participants);
    });

    newSocket.on('question-started', ({ questionIndex, timeLimit }) => {
      setCurrentQuestionIndex(questionIndex);
      setTimeLeft(timeLimit);
      setStatus('active');
    });

    newSocket.on('question-ended', ({ leaderboard }) => {
      setLeaderboard(leaderboard);
    });

    newSocket.on('quiz-completed', () => {
      setStatus('completed');
    });

    newSocket.on('error', (errorMessage) => {
      setError(errorMessage);
    });

    // Cleanup
    return () => {
      newSocket.close();
    };
  }, [code]);

  useEffect(() => {
    if (timeLeft > 0 && status === 'active') {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft, status]);

  const startQuiz = () => {
    if (!socket || !sessionId) return;
    socket.emit('start-quiz', { sessionId });
  };

  const startNextQuestion = () => {
    if (!socket || !sessionId || !quiz) return;
    
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= quiz.questions.length) {
      socket.emit('end-quiz', { sessionId });
      return;
    }
    
    socket.emit('start-question', {
      sessionId,
      questionIndex: nextIndex
    });
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Loading quiz...</h1>
      </div>
    );
  }

  if (status === 'waiting') {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6">
        <h1 className="text-3xl font-bold mb-6">{quiz.title}</h1>
        <Card className="p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Waiting Room</h2>
            <div>Join Code: <span className="font-bold text-xl">{code}</span></div>
          </div>
          
          <div className="mb-6">
            <h3 className="font-medium mb-2">Participants ({participants.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {participants.map((p) => (
                <div key={p._id} className="py-2 px-4 bg-gray-50 rounded">
                  {p.name}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Button 
              onClick={startQuiz} 
              disabled={participants.length === 0}
              className="w-full py-6 text-lg"
            >
              Start Quiz
            </Button>
          </div>
        </Card>
        
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quiz Overview</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Questions:</span>
              <span className="font-medium">{quiz.questions.length}</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'active' && quiz.questions[currentQuestionIndex]) {
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const progress = (currentQuestionIndex + 1) / quiz.questions.length * 100;
    
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div>
              Question {currentQuestionIndex + 1} of {quiz.questions.length}
            </div>
            <div className="text-lg font-medium">
              Time left: <span className="text-blue-600">{timeLeft}s</span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">{currentQuestion.text}</h2>
          
          <div className="grid gap-2 mb-6">
            {currentQuestion.options.map((option) => (
              <div 
                key={option._id} 
                className={`p-4 rounded-lg ${option.isCorrect ? 'border-2 border-green-500' : 'bg-gray-50'}`}
              >
                {option.text}
                {option.isCorrect && (
                  <span className="ml-2 text-green-600 font-medium">(Correct)</span>
                )}
              </div>
            ))}
          </div>
          
          {timeLeft === 0 ? (
            <Button onClick={startNextQuestion} className="w-full py-4">
              {currentQuestionIndex + 1 >= quiz.questions.length ? 'End Quiz' : 'Next Question'}
            </Button>
          ) : (
            <Button onClick={() => {}} disabled className="w-full py-4">
              Waiting for answers... ({timeLeft}s)
            </Button>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Current Leaderboard</h2>
          <div className="space-y-3">
            {leaderboard.slice(0, 5).map((p, i) => (
              <div
                key={p._id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{i + 1}.</span>
                  <span>{p.name}</span>
                </div>
                <span className="font-bold">{p.score} points</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6">
        <h1 className="text-3xl font-bold mb-6">Quiz Completed!</h1>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">Final Leaderboard</h2>
          <div className="space-y-4">
            {leaderboard.map((p, i) => (
              <div
                key={p._id}
                className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{i + 1}.</span>
                  <span>{p.name}</span>
                </div>
                <span className="font-bold">{p.score} points</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return null;
}