'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  Clock, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle,
  Flag,
  Eye
} from 'lucide-react';
import { Question, Option } from '@/types/quiz';
import React from 'react';

export default function QuizSession({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentName = searchParams?.get('name') || 'Student';
  const joinCode = React.use(params);
  
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [quizStatus, setQuizStatus] = useState<'loading' | 'waiting' | 'active' | 'completed' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [isFocused, setIsFocused] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showSubmitMessage, setShowSubmitMessage] = useState(false);
  const [submitReason, setSubmitReason] = useState<string>('');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const blurCount = useRef(0);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    // Fetch quiz data
    fetchQuizData();

    // Set up blur detection
    window.addEventListener('blur', ( ) => {submitQuiz('blur')});
    window.addEventListener('focus', handleWindowFocus);
    
    // Prevent right-click
    document.addEventListener('contextmenu', preventRightClick);
    
    // Set up devtools detection
    const devToolsDetector = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        handleDevToolsOpen();
      }
    };
    
    window.addEventListener('resize', devToolsDetector);
    
    // Check devtools on interval
    const devToolsInterval = setInterval(devToolsDetector, 1000);
    
    // return () => {
    //   if (timerRef.current) clearInterval(timerRef.current);
    //   window.removeEventListener('blur', handleWindowBlur);
    //   window.removeEventListener('focus', handleWindowFocus);
    //   window.removeEventListener('resize', devToolsDetector);
    //   document.removeEventListener('contextmenu', preventRightClick);
    //   clearInterval(devToolsInterval);
    // };
  }, [joinCode]);

  const preventRightClick = (e: MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const handleWindowBlur = async() => {

    // alert("window blur");
    console.log("window blur");
    
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    
    // Clean up timers
    if (timerRef.current) clearInterval(timerRef.current);
    
    try {
      const response = await fetch('/api/quiz-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizId: quiz._id,
          studentName,
          answers,
          focusLossCount: blurCount.current,
          timeUsed: quiz.timeLimit ? quiz.timeLimit - timeLeft : questions.reduce((sum, q) => sum + (q.timeLimit || 30), 0) - timeLeft,
          submissionReason: 'blur',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit quiz: ${response.status}`);
      }
      
      const resultData = await response.json();
      setResults(resultData);
      setQuizStatus('completed');
      
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }

    // await submitQuiz('blur');
    setIsFocused(false);
    blurCount.current += 1;
    logFocusEvent('blur');
    
    // Auto-submit the quiz when tab changes
    if (quizStatus === 'active' && !isSubmittingRef.current) {
      setSubmitReason('You left the quiz window. Quiz has been automatically submitted.');
      setShowSubmitMessage(true);
      // setResults(resultData);
      submitQuiz('tab_change');
    }
  };

  const handleWindowFocus = () => {
    setIsFocused(true);
    submitQuiz('manual');
    logFocusEvent('focus');
  };

  const handleDevToolsOpen = () => {
    if (quizStatus === 'active' && !isSubmittingRef.current) {
      setSubmitReason('Developer tools were detected. Quiz has been automatically submitted.');
      setShowSubmitMessage(true);
      submitQuiz('dev_tools');
    }
  };

  const logFocusEvent = async (eventType: 'blur' | 'focus') => {
    try {
      await fetch('/api/quiz-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizId: quiz?._id,
          studentName,
          eventType,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to log focus event:', error);
    }
  };

  const fetchQuizData = async () => {
    setQuizStatus('loading');
    
    try {
      console.log("join code frontend", joinCode);
      
      const response = await fetch(`/api/quizzes/join/${joinCode.code}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch quiz: ${response.status}`);
      }
      
      const data = await response.json();
      
      setQuiz(data);
      
      if (!data.isActive) {
        setQuizStatus('waiting');
        return;
      }
      
      // Sort questions by their order
      const sortedQuestions = [...data.questions].sort((a, b) => a.order - b.order);
      
      // Initialize the answers object with empty arrays for each question
      const initialAnswers: Record<string, string[]> = {};
      sortedQuestions.forEach(q => {
        initialAnswers[q.id] = [];
      });
      
      setQuestions(sortedQuestions);
      setAnswers(initialAnswers);
      setQuizStatus('active');
      
      // Calculate total time for the quiz (time limit for entire quiz)
      const totalTime = data.timeLimit || sortedQuestions.reduce((sum, q) => sum + (q.timeLimit || 30), 0);
      setTimeLeft(totalTime);
      
      // Start the overall quiz timer
      startQuizTimer();
      
    } catch (error) {
      console.error('Failed to fetch quiz:', error);
      setError('Failed to load quiz. Please check the join code and try again.');
      setQuizStatus('error');
    }
  };

  const startQuizTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - submit the quiz
          if (timerRef.current) clearInterval(timerRef.current);
          setSubmitReason('Time is up. Quiz has been automatically submitted.');
          setShowSubmitMessage(true);
          submitQuiz('time_up');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (questionId: string, optionId: string) => {
    const question = questions.find(q => q.id === questionId);
    
    if (!question) return;
    
    if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
      // Single select - replace previous answers
      setAnswers({
        ...answers,
        [questionId]: [optionId],
      });
    } else if (question.type === 'MULTIPLE_CORRECT') {
      // Multiple select - toggle the option
      const currentAnswers = answers[questionId] || [];
      
      if (currentAnswers.includes(optionId)) {
        setAnswers({
          ...answers,
          [questionId]: currentAnswers.filter(id => id !== optionId),
        });
      } else {
        setAnswers({
          ...answers,
          [questionId]: [...currentAnswers, optionId],
        });
      }
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const toggleFlagQuestion = () => {
    const newFlagged = new Set(flaggedQuestions);
    
    if (flaggedQuestions.has(currentQuestionIndex)) {
      newFlagged.delete(currentQuestionIndex);
    } else {
      newFlagged.add(currentQuestionIndex);
    }
    
    setFlaggedQuestions(newFlagged);
  };

  const jumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const submitQuiz = async (reason: string = 'manual') => {
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    
    // Clean up timers
    if (timerRef.current) clearInterval(timerRef.current);
    
    try {
      const response = await fetch('/api/quiz-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizId: quiz._id,
          studentName,
          answers,
          focusLossCount: blurCount.current,
          timeUsed: quiz.timeLimit ? quiz.timeLimit - timeLeft : questions.reduce((sum, q) => sum + (q.timeLimit || 30), 0) - timeLeft,
          submissionReason: reason,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit quiz: ${response.status}`);
      }
      
      const resultData = await response.json();
      setResults(resultData);
      setQuizStatus('completed');
      
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const calculateProgressPercentage = () => {
    const totalQuestions = questions.length;
    const answeredCount = Object.values(answers).filter(ans => ans.length > 0).length;
    return Math.round((answeredCount / totalQuestions) * 100);
  };

  const closeSubmitMessage = () => {
    setShowSubmitMessage(false);
  };

  if (quizStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (quizStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
          <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Quiz is not active yet</h2>
          <p className="mb-4">Please wait for the quiz to be started by the instructor.</p>
          <Button onClick={() => fetchQuizData()}>Refresh</Button>
        </div>
      </div>
    );
  }

  if (quizStatus === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="mb-4">{error}</p>
          <Button onClick={() => router.push('/quiz/join')}>
            Return to Join Page
          </Button>
        </div>
      </div>
    );
  }

  if (quizStatus === 'completed' && results) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-6">
          <div className="text-center mb-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Quiz Completed!</h2>
            <p className="text-xl">Your score: {results.score} / {results.totalPoints}</p>
            <p className="text-gray-500">
              {results.score >= results.totalPoints * 0.7 
                ? "Great job! You did well on this quiz." 
                : "Keep practicing! You'll do better next time."}
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Quiz Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Correct Answers</p>
                <p className="text-2xl font-bold">{results.correctAnswers}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Total Questions</p>
                <p className="text-2xl font-bold">{results.totalQuestions}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Time Used</p>
                <p className="text-2xl font-bold">{formatTime(results.timeUsed)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Accuracy</p>
                <p className="text-2xl font-bold">
                  {Math.round((results.correctAnswers / results.totalQuestions) * 100)}%
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button onClick={() => router.push('/quiz/join')}>
              Join Another Quiz
            </Button>
            <Button variant="outline" onClick={() => router.push('/student/results')}>
              View All Results
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active quiz session
  const currentQuestion = questions[currentQuestionIndex];
  
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p>Question not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Auto-submit message modal */}
      {showSubmitMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Quiz Submitted</h2>
            <p className="mb-4">
              {submitReason}
            </p>
            <Button onClick={closeSubmitMessage}>Close</Button>
          </div>
        </div>
      )}

      {/* Tab change warning */}
      {!isFocused && !showSubmitMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Warning: Focus Lost</h2>
            <p className="mb-4">
              You've left the quiz window. This may be considered cheating.
              The quiz will be automatically submitted if you leave again.
            </p>
            <Button onClick={() => setIsFocused(true)}>Return to Quiz</Button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header with timer and progress */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex justify-between items-center">
          <div className="flex items-center">
            <p className="font-semibold">{quiz?.title}</p>
            <span className="mx-2">•</span>
            <p>{studentName}</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1 text-blue-500" />
              <span className="text-sm">
                Time Remaining: {formatTime(timeLeft)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="w-full bg-gray-200 h-2 rounded-full">
            <div 
              className="bg-blue-500 h-2 rounded-full" 
              style={{ width: `${calculateProgressPercentage()}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-500">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{calculateProgressPercentage()}% Complete</span>
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">
              Question {currentQuestionIndex + 1}
              {flaggedQuestions.has(currentQuestionIndex) && (
                <span className="ml-2 text-yellow-500">
                  <Flag className="h-4 w-4 inline" />
                </span>
              )}
            </h2>
            <div className="flex items-center text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
              <Clock className="h-4 w-4 mr-1" />
              {formatTime(timeLeft)}
            </div>
          </div>
          
          <p className="text-lg mb-6">{currentQuestion.text}</p>
          
          <div className="space-y-3">
            {currentQuestion.options.map((option: Option) => (
              <div
                key={option.id}
                onClick={() => handleOptionSelect(currentQuestion.id, option.id)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  answers[currentQuestion.id]?.includes(option.id)
                    ? 'bg-blue-100 border-blue-300'
                    : 'hover:bg-gray-50'
                }`}
              >
                {option.text}
              </div>
            ))}
          </div>
        </div>

        {/* Question navigation */}
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="outline"
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={toggleFlagQuestion}
            >
              <Flag className={`h-4 w-4 mr-2 ${flaggedQuestions.has(currentQuestionIndex) ? 'text-yellow-500' : ''}`} />
              {flaggedQuestions.has(currentQuestionIndex) ? 'Unflag' : 'Flag for Review'}
            </Button>
            
            <Button onClick={() => submitQuiz('manual')} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                'Submit Quiz'
              )}
            </Button>
          </div>
          
          <Button
            variant={currentQuestionIndex === questions.length - 1 ? 'outline' : 'default'}
            onClick={handleNextQuestion}
            disabled={currentQuestionIndex === questions.length - 1}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Question navigator */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-2">Question Navigator</h3>
          <div className="grid grid-cols-8 gap-2 md:grid-cols-10">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => jumpToQuestion(index)}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm
                  ${currentQuestionIndex === index ? 'bg-blue-500 text-white' : 
                    answers[questions[index].id]?.length ? 'bg-green-100 text-green-800' : 'bg-gray-100'}
                  ${flaggedQuestions.has(index) ? 'ring-2 ring-yellow-400' : ''}
                `}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-xs text-gray-500">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-gray-100 mr-1"></div>
              <span>Not answered</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-100 mr-1"></div>
              <span>Answered</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-gray-100 ring-2 ring-yellow-400 mr-1"></div>
              <span>Flagged</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



// // app/quiz/session/[code]/page.tsx
// 'use client';

// import { useState, useEffect, useRef } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { Button } from '@/components/ui/button';
// import { 
//   AlertCircle, 
//   Clock, 
//   ArrowLeft, 
//   ArrowRight, 
//   CheckCircle,
//   Flag,
//   Eye
// } from 'lucide-react';
// import { Question, Option } from '@/types/quiz';
// import React from 'react';

// export default function QuizSession({ params }: { params: Promise<{ code: string }> }) {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const studentName = searchParams?.get('name') || 'Student';

//   const joinCode = React.use(params);
  
//   const [quiz, setQuiz] = useState<any>(null);
//   const [questions, setQuestions] = useState<Question[]>([]);
//   const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
//   const [answers, setAnswers] = useState<Record<string, string[]>>({});
//   const [timeLeft, setTimeLeft] = useState<number>(0);
//   const [quizStatus, setQuizStatus] = useState<'loading' | 'waiting' | 'active' | 'completed' | 'error'>('loading');
//   const [error, setError] = useState<string | null>(null);
//   const [remainingTime, setRemainingTime] = useState<number>(0);
//   const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
//   const [isFocused, setIsFocused] = useState(true);
//   const [focusWarnings, setFocusWarnings] = useState(0);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [results, setResults] = useState<any>(null);
  
//   const timerRef = useRef<NodeJS.Timeout | null>(null);
//   const questionTimerRef = useRef<NodeJS.Timeout | null>(null);
//   const blurCount = useRef(0);

//   useEffect(() => {
//     // Fetch quiz data
//     fetchQuizData();

//     // Set up blur detection
//     window.addEventListener('blur', handleWindowBlur);
//     window.addEventListener('focus', handleWindowFocus);
    
//     // Prevent right-click
//     document.addEventListener('contextmenu', preventRightClick);
    
//     return () => {
//       if (timerRef.current) clearInterval(timerRef.current);
//       if (questionTimerRef.current) clearInterval(questionTimerRef.current);
//       window.removeEventListener('blur', handleWindowBlur);
//       window.removeEventListener('focus', handleWindowFocus);
//       document.removeEventListener('contextmenu', preventRightClick);
//     };
//   }, [joinCode]);

//   useEffect(() => {
//     // Start question timer when current question changes
//     if (quizStatus === 'active' && questions.length > 0) {
//       startQuestionTimer();
//     }
//   }, [currentQuestionIndex, quizStatus]);

//   const preventRightClick = (e: MouseEvent) => {
//     e.preventDefault();
//     return false;
//   };

//   const handleWindowBlur = () => {
//     setIsFocused(false);
//     blurCount.current += 1;
    
//     if (blurCount.current >= 3) {
//       setFocusWarnings(focusWarnings + 1);
//     }
    
//     // Log focus loss event
//     logFocusEvent('blur');
//   };

//   const handleWindowFocus = () => {
//     setIsFocused(true);
//     // Log focus return event
//     logFocusEvent('focus');
//   };

//   const logFocusEvent = async (eventType: 'blur' | 'focus') => {
//     try {
//       await fetch('/api/quiz-logs', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           quizId: quiz?._id,
//           studentName,
//           eventType,
//           timestamp: new Date().toISOString(),
//         }),
//       });
//     } catch (error) {
//       console.error('Failed to log focus event:', error);
//     }
//   };

//   const fetchQuizData = async () => {
//     setQuizStatus('loading');
    
//     try {
//       const response = await fetch(`/api/quizzes/join/${joinCode}`);
      
//       if (!response.ok) {
//         throw new Error(`Failed to fetch quiz: ${response.status}`);
//       }
      
//       const data = await response.json();
      
//       setQuiz(data);
      
//       if (!data.isActive) {
//         setQuizStatus('waiting');
//         return;
//       }
      
//       // Sort questions by their order
//       const sortedQuestions = [...data.questions].sort((a, b) => a.order - b.order);
      
//       // Initialize the answers object with empty arrays for each question
//       const initialAnswers: Record<string, string[]> = {};
//       sortedQuestions.forEach(q => {
//         initialAnswers[q.id] = [];
//       });
      
//       setQuestions(sortedQuestions);
//       setAnswers(initialAnswers);
//       setQuizStatus('active');
      
//       // Calculate total time for the quiz
//       const totalTime = sortedQuestions.reduce((sum, q) => sum + (q.timeLimit || 30), 0);
//       setTimeLeft(totalTime);
//       setRemainingTime(sortedQuestions[0]?.timeLimit || 30);
      
//       // Start the overall quiz timer
//       startQuizTimer();
      
//       // Start the first question timer
//       startQuestionTimer();
      
//     } catch (error) {
//       console.error('Failed to fetch quiz:', error);
//       setError('Failed to load quiz. Please check the join code and try again.');
//       setQuizStatus('error');
//     }
//   };

//   const startQuizTimer = () => {
//     if (timerRef.current) {
//       clearInterval(timerRef.current);
//     }
    
//     timerRef.current = setInterval(() => {
//       setTimeLeft(prev => {
//         if (prev <= 1) {
//           // Time's up - submit the quiz
//           if (timerRef.current) clearInterval(timerRef.current);
//           submitQuiz();
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);
//   };

//   const startQuestionTimer = () => {
//     if (questionTimerRef.current) {
//       clearInterval(questionTimerRef.current);
//     }
    
//     const questionTimeLimit = questions[currentQuestionIndex]?.timeLimit || 30;
//     setRemainingTime(questionTimeLimit);
    
//     questionTimerRef.current = setInterval(() => {
//       setRemainingTime(prev => {
//         if (prev <= 1) {
//           // Time's up for this question - move to next one
//           if (questionTimerRef.current) clearInterval(questionTimerRef.current);
          
//           if (currentQuestionIndex < questions.length - 1) {
//             handleNextQuestion();
//           } else {
//             submitQuiz();
//           }
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);
//   };

//   const formatTime = (seconds: number): string => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}:${secs.toString().padStart(2, '0')}`;
//   };

//   const handleOptionSelect = (questionId: string, optionId: string) => {
//     const question = questions.find(q => q.id === questionId);
    
//     if (!question) return;
    
//     if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
//       // Single select - replace previous answers
//       setAnswers({
//         ...answers,
//         [questionId]: [optionId],
//       });
//     } else if (question.type === 'MULTIPLE_CORRECT') {
//       // Multiple select - toggle the option
//       const currentAnswers = answers[questionId] || [];
      
//       if (currentAnswers.includes(optionId)) {
//         setAnswers({
//           ...answers,
//           [questionId]: currentAnswers.filter(id => id !== optionId),
//         });
//       } else {
//         setAnswers({
//           ...answers,
//           [questionId]: [...currentAnswers, optionId],
//         });
//       }
//     }
//   };

//   const handlePreviousQuestion = () => {
//     if (currentQuestionIndex > 0) {
//       setCurrentQuestionIndex(currentQuestionIndex - 1);
//     }
//   };

//   const handleNextQuestion = () => {
//     if (currentQuestionIndex < questions.length - 1) {
//       setCurrentQuestionIndex(currentQuestionIndex + 1);
//     }
//   };

//   const toggleFlagQuestion = () => {
//     const newFlagged = new Set(flaggedQuestions);
    
//     if (flaggedQuestions.has(currentQuestionIndex)) {
//       newFlagged.delete(currentQuestionIndex);
//     } else {
//       newFlagged.add(currentQuestionIndex);
//     }
    
//     setFlaggedQuestions(newFlagged);
//   };

//   const jumpToQuestion = (index: number) => {
//     setCurrentQuestionIndex(index);
//   };

//   const submitQuiz = async () => {
//     if (isSubmitting) return;
    
//     setIsSubmitting(true);
    
//     // Clean up timers
//     if (timerRef.current) clearInterval(timerRef.current);
//     if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    
//     try {
//       const response = await fetch('/api/quiz-submission', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           quizId: quiz._id,
//           studentName,
//           answers,
//           focusLossCount: blurCount.current,
//           timeUsed: quiz.questions.reduce((sum: number, q: any) => sum + (q.timeLimit || 30), 0) - timeLeft,
//         }),
//       });
      
//       if (!response.ok) {
//         throw new Error(`Failed to submit quiz: ${response.status}`);
//       }
      
//       const resultData = await response.json();
//       setResults(resultData);
//       setQuizStatus('completed');
      
//     } catch (error) {
//       console.error('Failed to submit quiz:', error);
//       setError('Failed to submit quiz. Please try again.');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const calculateProgressPercentage = () => {
//     const totalQuestions = questions.length;
//     const answeredCount = Object.values(answers).filter(ans => ans.length > 0).length;
//     return Math.round((answeredCount / totalQuestions) * 100);
//   };

//   if (quizStatus === 'loading') {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
//           <p>Loading quiz...</p>
//         </div>
//       </div>
//     );
//   }

//   if (quizStatus === 'waiting') {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
//           <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
//           <h2 className="text-xl font-bold mb-2">Quiz is not active yet</h2>
//           <p className="mb-4">Please wait for the quiz to be started by the instructor.</p>
//           <Button onClick={() => fetchQuizData()}>Refresh</Button>
//         </div>
//       </div>
//     );
//   }

//   if (quizStatus === 'error') {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
//           <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
//           <h2 className="text-xl font-bold mb-2">Error</h2>
//           <p className="mb-4">{error}</p>
//           <Button onClick={() => router.push('/quiz/join')}>
//             Return to Join Page
//           </Button>
//         </div>
//       </div>
//     );
//   }

//   if (quizStatus === 'completed' && results) {
//     return (
//       <div className="min-h-screen bg-gray-50 p-6">
//         <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-6">
//           <div className="text-center mb-8">
//             <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
//             <h2 className="text-2xl font-bold mb-2">Quiz Completed!</h2>
//             <p className="text-xl">Your score: {results.score} / {results.totalPoints}</p>
//             <p className="text-gray-500">
//               {results.score >= results.totalPoints * 0.7 
//                 ? "Great job! You did well on this quiz." 
//                 : "Keep practicing! You'll do better next time."}
//             </p>
//           </div>

//           <div className="mb-6">
//             <h3 className="text-lg font-semibold mb-2">Quiz Summary</h3>
//             <div className="grid grid-cols-2 gap-4">
//               <div className="p-4 bg-gray-50 rounded-lg">
//                 <p className="text-gray-500">Correct Answers</p>
//                 <p className="text-2xl font-bold">{results.correctAnswers}</p>
//               </div>
//               <div className="p-4 bg-gray-50 rounded-lg">
//                 <p className="text-gray-500">Total Questions</p>
//                 <p className="text-2xl font-bold">{results.totalQuestions}</p>
//               </div>
//               <div className="p-4 bg-gray-50 rounded-lg">
//                 <p className="text-gray-500">Time Used</p>
//                 <p className="text-2xl font-bold">{formatTime(results.timeUsed)}</p>
//               </div>
//               <div className="p-4 bg-gray-50 rounded-lg">
//                 <p className="text-gray-500">Accuracy</p>
//                 <p className="text-2xl font-bold">
//                   {Math.round((results.correctAnswers / results.totalQuestions) * 100)}%
//                 </p>
//               </div>
//             </div>
//           </div>

//           <div className="flex justify-between">
//             <Button onClick={() => router.push('/quiz/join')}>
//               Join Another Quiz
//             </Button>
//             <Button variant="outline" onClick={() => router.push('/student/results')}>
//               View All Results
//             </Button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Active quiz session
//   const currentQuestion = questions[currentQuestionIndex];
  
//   if (!currentQuestion) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
//           <p>Question not found</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 p-4">
//       {!isFocused && (
//         <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
//           <div className="bg-white p-6 rounded-lg max-w-md text-center">
//             <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
//             <h2 className="text-xl font-bold mb-2">Warning: Focus Lost</h2>
//             <p className="mb-4">
//               You've left the quiz window. This may be considered cheating.
//               {focusWarnings >= 2 && " Multiple violations may result in disqualification."}
//             </p>
//             <Button onClick={() => setIsFocused(true)}>Return to Quiz</Button>
//           </div>
//         </div>
//       )}

//       <div className="max-w-4xl mx-auto">
//         {/* Header with timers and progress */}
//         <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex justify-between items-center">
//           <div className="flex items-center">
//             <p className="font-semibold">{quiz?.title}</p>
//             <span className="mx-2">•</span>
//             <p>{studentName}</p>
//           </div>
          
//           <div className="flex items-center space-x-4">
//             <div className="flex items-center">
//               <Clock className="h-4 w-4 mr-1 text-amber-500" />
//               <span className="text-sm">
//                 Question: {formatTime(remainingTime)}
//               </span>
//             </div>
//             <div className="flex items-center">
//               <Clock className="h-4 w-4 mr-1 text-blue-500" />
//               <span className="text-sm">
//                 Total: {formatTime(timeLeft)}
//               </span>
//             </div>
//           </div>
//         </div>

//         {/* Progress bar */}
//         <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
//           <div className="w-full bg-gray-200 h-2 rounded-full">
//             <div 
//               className="bg-blue-500 h-2 rounded-full" 
//               style={{ width: `${calculateProgressPercentage()}%` }}
//             />
//           </div>
//           <div className="flex justify-between mt-2 text-sm text-gray-500">
//             <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
//             <span>{calculateProgressPercentage()}% Complete</span>
//           </div>
//         </div>

//         {/* Question card */}
//         <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
//           <div className="flex justify-between items-start mb-4">
//             <h2 className="text-xl font-semibold">
//               Question {currentQuestionIndex + 1}
//               {flaggedQuestions.has(currentQuestionIndex) && (
//                 <span className="ml-2 text-yellow-500">
//                   <Flag className="h-4 w-4 inline" />
//                 </span>
//               )}
//             </h2>
//             <div className="flex items-center text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
//               <Clock className="h-4 w-4 mr-1" />
//               {formatTime(remainingTime)}
//             </div>
//           </div>
          
//           <p className="text-lg mb-6">{currentQuestion.text}</p>
          
//           <div className="space-y-3">
//             {currentQuestion.options.map((option: Option) => (
//               <div
//                 key={option.id}
//                 onClick={() => handleOptionSelect(currentQuestion.id, option.id)}
//                 className={`p-3 border rounded-lg cursor-pointer transition-colors ${
//                   answers[currentQuestion.id]?.includes(option.id)
//                     ? 'bg-blue-100 border-blue-300'
//                     : 'hover:bg-gray-50'
//                 }`}
//               >
//                 {option.text}
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Question navigation */}
//         <div className="flex justify-between items-center mb-4">
//           <Button
//             variant="outline"
//             onClick={handlePreviousQuestion}
//             disabled={currentQuestionIndex === 0}
//           >
//             <ArrowLeft className="h-4 w-4 mr-2" />
//             Previous
//           </Button>
          
//           <div className="flex space-x-2">
//             <Button
//               variant="outline"
//               onClick={toggleFlagQuestion}
//             >
//               <Flag className={`h-4 w-4 mr-2 ${flaggedQuestions.has(currentQuestionIndex) ? 'text-yellow-500' : ''}`} />
//               {flaggedQuestions.has(currentQuestionIndex) ? 'Unflag' : 'Flag for Review'}
//             </Button>
            
//             {currentQuestionIndex === questions.length - 1 && (
//               <Button onClick={submitQuiz} disabled={isSubmitting}>
//                 {isSubmitting ? (
//                   <>
//                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
//                     Submitting...
//                   </>
//                 ) : (
//                   'Submit Quiz'
//                 )}
//               </Button>
//             )}
//           </div>
          
//           <Button
//             variant={currentQuestionIndex === questions.length - 1 ? 'outline' : 'default'}
//             onClick={handleNextQuestion}
//             disabled={currentQuestionIndex === questions.length - 1}
//           >
//             Next
//             <ArrowRight className="h-4 w-4 ml-2" />
//           </Button>
//         </div>

//         {/* Question navigator */}
//         <div className="bg-white rounded-lg shadow-sm p-4">
//           <h3 className="text-sm font-semibold mb-2">Question Navigator</h3>
//           <div className="grid grid-cols-8 gap-2 md:grid-cols-10">
//             {questions.map((_, index) => (
//               <button
//                 key={index}
//                 onClick={() => jumpToQuestion(index)}
//                 className={`
//                   w-8 h-8 rounded-full flex items-center justify-center text-sm
//                   ${currentQuestionIndex === index ? 'bg-blue-500 text-white' : 
//                     answers[questions[index].id]?.length ? 'bg-green-100 text-green-800' : 'bg-gray-100'}
//                   ${flaggedQuestions.has(index) ? 'ring-2 ring-yellow-400' : ''}
//                 `}
//               >
//                 {index + 1}
//               </button>
//             ))}
//           </div>
//           <div className="flex justify-between mt-4 text-xs text-gray-500">
//             <div className="flex items-center">
//               <div className="w-3 h-3 rounded-full bg-gray-100 mr-1"></div>
//               <span>Not answered</span>
//             </div>
//             <div className="flex items-center">
//               <div className="w-3 h-3 rounded-full bg-green-100 mr-1"></div>
//               <span>Answered</span>
//             </div>
//             <div className="flex items-center">
//               <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
//               <span>Current</span>
//             </div>
//             <div className="flex items-center">
//               <Flag className="h-3 w-3 text-yellow-500 mr-1" />
//               <span>Flagged</span>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }