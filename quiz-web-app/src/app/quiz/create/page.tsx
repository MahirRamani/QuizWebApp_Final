// app/quiz/create/page.tsx
// app/quiz/create/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Trash2, 
  Copy, 
  Clock,
  AlertCircle,
  Save,
  ArrowLeft,
  Share2
} from 'lucide-react';
import { Question, QuestionType, Option } from '@/types/quiz';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

interface QuestionTemplate {
  type: QuestionType;
  defaultTimeLimit: number;
  minOptions: number;
}

const questionTemplates: Record<QuestionType, QuestionTemplate> = {
  MCQ: {
    type: 'MCQ',
    defaultTimeLimit: 30,
    minOptions: 4,
  },
  TRUE_FALSE: {
    type: 'TRUE_FALSE',
    defaultTimeLimit: 15,
    minOptions: 2,
  },
  MULTIPLE_CORRECT: {
    type: 'MULTIPLE_CORRECT',
    defaultTimeLimit: 45,
    minOptions: 5,
  },
};

export default function QuizEditor() {
  const router = useRouter();
  const pathname = usePathname();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string>('');

  useEffect(() => {
    // Check if we're in edit mode based on the URL path
    if (pathname.includes('/edit/')) {
      // Extract the ID more carefully
      const pathParts = pathname.split('/');
      const id = pathParts[pathParts.length - 1];
      
      console.log("Extracted ID:", id);
      
      if (id && id.trim() !== '') {
        setQuizId(id);
        fetchQuizData(id);
        
        // Set up share link
        const baseUrl = window.location.origin;
        setShareLink(`${baseUrl}/quiz/edit/${id}`);
      } else {
        setErrorMessage('Invalid quiz ID in URL');
      }
    }
  }, [pathname]);

  const fetchQuizData = async (id: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      console.log(`Fetching quiz data from: /api/quizzes/${id}`);
      
      const response = await fetch(`/api/quizzes/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('API Response Status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        
        throw new Error(`Failed to fetch quiz: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched quiz data:', data);
      
      // Check if data has the expected structure
      if (!data || !data.title) {
        throw new Error('Quiz data is invalid or incomplete');
      }
      
      setTitle(data.title);
      setDescription(data.description || '');
      
      // Ensure questions have valid structure
      if (Array.isArray(data.questions)) {
        // Make sure all questions have required properties
        const validatedQuestions = data.questions.map((q: any, index: number) => ({
          id: q.id || uuidv4(),
          type: q.type || 'MCQ',
          text: q.text || '',
          options: Array.isArray(q.options) 
            ? q.options.map((opt: any) => ({
                id: opt.id || uuidv4(),
                text: opt.text || '',
                isCorrect: Boolean(opt.isCorrect),
              }))
            : [],
          timeLimit: q.timeLimit || 30,
          order: q.order !== undefined ? q.order : index,
        }));
        
        setQuestions(validatedQuestions);
      } else {
        // If no questions or invalid format, set empty array
        setQuestions([]);
      }
      
      setIsEditing(true);
    } catch (error) {
      console.error('Failed to fetch quiz:', error);
      
      // Set a more descriptive error message
      if (error instanceof Error) {
        setErrorMessage(`Failed to load quiz data: ${error.message}. Please check the quiz ID and try again.`);
      } else {
        setErrorMessage('Failed to load quiz data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createNewQuestion = (type: QuestionType) => {
    const template = questionTemplates[type];
    const newQuestion: Question = {
      id: uuidv4(),
      type,
      text: '',
      options: Array(template.minOptions).fill(null).map(() => ({
        id: uuidv4(),
        text: '',
        isCorrect: false,
      })),
      timeLimit: template.defaultTimeLimit,
      order: questions.length,
      marks: 0
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ));
  };

  const deleteQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const duplicateQuestion = (questionId: string) => {
    const questionToDuplicate = questions.find(q => q.id === questionId);
    if (questionToDuplicate) {
      const duplicatedQuestion = {
        ...questionToDuplicate,
        id: uuidv4(),
        options: questionToDuplicate.options.map(opt => ({
          ...opt,
          id: uuidv4(),
        })),
        order: questions.length,
      };
      setQuestions([...questions, duplicatedQuestion]);
    }
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: [...q.options, { id: uuidv4(), text: '', isCorrect: false }],
        };
      }
      return q;
    }));
  };

  const deleteOption = (questionId: string, optionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: q.options.filter(opt => opt.id !== optionId),
        };
      }
      return q;
    }));
  };

  const updateOption = (
    questionId: string,
    optionId: string,
    updates: Partial<Option>
  ) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: q.options.map(opt =>
            opt.id === optionId ? { ...opt, ...updates } : opt
          ),
        };
      }
      return q;
    }));
  };

  const saveQuiz = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const endpoint = isEditing ? `/api/quizzes/${quizId}` : '/api/quizzes';
      const method = isEditing ? 'PUT' : 'POST';
      
      console.log(`Saving quiz to endpoint: ${endpoint} with method: ${method}`);
      console.log('Quiz data being sent:', {
        title,
        description,
        questionsCount: questions.length
      });
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          questions,
          createdBy: 'current-user-id', // Replace with actual user ID
        }),
      });

      console.log('Save response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        
        throw new Error(`Failed to save quiz: ${response.status}`);
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to save quiz:', error);
      
      if (error instanceof Error) {
        setErrorMessage(`Failed to save quiz: ${error.message}. Please try again.`);
      } else {
        setErrorMessage('Failed to save quiz. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink)
      .then(() => {
        alert('Share link copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
      });
  };

  if (isLoading && isEditing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading quiz data...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="mb-4">{errorMessage}</p>
          <Link href="/dashboard">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link href="/dashboard">
              <Button variant="ghost" className="mr-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">
              {isEditing ? 'Edit Quiz' : 'Create New Quiz'}
            </h1>
          </div>
          
          {/* Share button for edit mode */}
          {isEditing && (
            <Button variant="outline" onClick={copyShareLink}>
              <Share2 className="h-4 w-4 mr-2" />
              Share Link
            </Button>
          )}
        </div>
        
        {/* Quiz Title Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <Input
            placeholder="Quiz Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold mb-4"
          />
          <Input
            placeholder="Quiz Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Questions Section */}
        <div className="space-y-6">
          {questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 mr-4">
                  <Input
                    placeholder="Question Text"
                    value={question.text}
                    onChange={(e) =>
                      updateQuestion(question.id, { text: e.target.value })
                    }
                    className="mb-4"
                  />
                  
                  {/* Question Type Badge */}
                  <div className="mb-4">
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      {question.type}
                    </span>
                  </div>
                  
                  {/* Options */}
                  <div className="space-y-2 ml-4">
                    {question.options.map((option) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <Input
                          placeholder="Option Text"
                          value={option.text}
                          onChange={(e) =>
                            updateOption(question.id, option.id, {
                              text: e.target.value,
                            })
                          }
                          className="flex-1"
                        />
                        <Button
                          variant={option.isCorrect ? "default" : "outline"}
                          onClick={() =>
                            updateOption(question.id, option.id, {
                              isCorrect: !option.isCorrect,
                            })
                          }
                          className="w-24"
                        >
                          {option.isCorrect ? "Correct" : "Wrong"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => deleteOption(question.id, option.id)}
                          disabled={question.options.length <= 
                            (question.type === 'TRUE_FALSE' ? 2 : 
                             question.type === 'MCQ' ? 2 : 3)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => addOption(question.id)}
                    className="mt-2 ml-4"
                    disabled={question.type === 'TRUE_FALSE' && question.options.length >= 2}
                  >
                    Add Option
                  </Button>
                </div>

                {/* Question Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => duplicateQuestion(question.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => deleteQuestion(question.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <Input
                      type="number"
                      value={question.timeLimit}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          timeLimit: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-16"
                      min="5"
                      max="300"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {questions.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h3 className="text-lg font-medium mb-2">No questions yet</h3>
            <p className="text-gray-500 mb-4">
              Add questions using the panel on the left
            </p>
          </div>
        )}

        {/* Question Type Sidebar */}
        <div className="fixed left-4 top-1/4 transform -translate-y-1/2 bg-white p-4 rounded-lg shadow-lg w-48">
          <h3 className="text-sm font-semibold mb-4">Add Question</h3>
          <div className="space-y-2">
            {Object.entries(questionTemplates).map(([type]) => (
              <Button
                key={type}
                className="w-full"
                variant="outline"
                onClick={() => createNewQuestion(type as QuestionType)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="fixed bottom-6 right-6">
          <Button
            onClick={saveQuiz}
            className="px-6"
            disabled={!title || questions.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isEditing ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Update Quiz' : 'Save Quiz'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
// // app/quiz/create/page.tsx
// 'use client';

// import { useState, useEffect, useRef } from 'react';
// import { useRouter, usePathname } from 'next/navigation';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { 
//   Trash2, 
//   Copy, 
//   Clock,
//   AlertCircle,
//   Save,
//   ArrowLeft,
//   Users,
//   Share2
// } from 'lucide-react';
// import { Question, QuestionType, Option, User } from '@/types/quiz';
// import { v4 as uuidv4 } from 'uuid';
// import Link from 'next/link';
// // import { io, Socket } from "socket.io-client";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "@/components/ui/tooltip";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// interface QuestionTemplate {
//   type: QuestionType;
//   defaultTimeLimit: number;
//   minOptions: number;
//   defaultMarks: number;
// }

// const questionTemplates: Record<QuestionType, QuestionTemplate> = {
//   MCQ: {
//     type: 'MCQ',
//     defaultTimeLimit: 30,
//     minOptions: 4,
//     defaultMarks: 1,
//   },
//   TRUE_FALSE: {
//     type: 'TRUE_FALSE',
//     defaultTimeLimit: 15,
//     minOptions: 2,
//     defaultMarks: 1,
//   },
//   MULTIPLE_CORRECT: {
//     type: 'MULTIPLE_CORRECT',
//     defaultTimeLimit: 45,
//     minOptions: 5,
//     defaultMarks: 1,
//   },
// };

// // Sample colors for user cursors and avatars
// const userColors = [
//   'bg-red-500',
//   'bg-blue-500',
//   'bg-green-500',
//   'bg-yellow-500',
//   'bg-purple-500',
//   'bg-pink-500',
//   'bg-indigo-500',
//   'bg-orange-500',
// ];

// export default function QuizEditor() {
//   const router = useRouter();
//   const pathname = usePathname();
//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [questions, setQuestions] = useState<Question[]>([]);
//   const [isEditing, setIsEditing] = useState(false);
//   const [quizId, setQuizId] = useState<string | null>(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);
//   const [activeUsers, setActiveUsers] = useState<User[]>([]);
//   const [shareDialogOpen, setShareDialogOpen] = useState(false);
//   const [shareLink, setShareLink] = useState('');
//   // const socketRef = useRef<Socket | null>(null);
//   const currentUserRef = useRef<User>({
//     id: uuidv4(),
//     name: `User-${Math.floor(Math.random() * 1000)}`,
//     color: userColors[Math.floor(Math.random() * userColors.length)],
//     cursor: { x: 0, y: 0 },
//     lastActivity: Date.now(),
//   });
//   const lastSyncedStateRef = useRef<any>(null);
//   const [showCursors, setShowCursors] = useState(true);
  
//   // Setup socket connection
//   // useEffect(() => {
//   //   if (!quizId) return;
    
//   //   // Initialize Socket.io connection
//   //   // socketRef.current = io('/quiz-collaboration', {
//   //   //   query: { quizId, userId: currentUserRef.current.id }
//   //   // });
    
//   //   // // Set up Socket.io event listeners
//   //   // const socket = socketRef.current;
    
//   //   // Handle initial connection
//   //   // socket.on('connect', () => {
//   //   //   console.log('Connected to collaboration server');
//   //   //   // Join the room for this quiz
//   //   //   socket.emit('join-room', { 
//   //   //     quizId, 
//   //   //     user: currentUserRef.current 
//   //   //   });
//   //   // });
    
//   //   // Handle active users update
//   //   // socket.on('active-users', (users: User[]) => {
//   //   //   setActiveUsers(users.filter(user => user.id !== currentUserRef.current.id));
//   //   // });
    
//   //   // Handle quiz state updates from other users
//   //   // socket.on('quiz-update', (updatedQuiz: any) => {
//   //   //   // Only update if the data has changed from what we know
//   //   //   if (JSON.stringify(updatedQuiz) !== JSON.stringify(lastSyncedStateRef.current)) {
//   //   //     setTitle(updatedQuiz.title);
//   //   //     setDescription(updatedQuiz.description);
//   //   //     setQuestions(updatedQuiz.questions);
//   //   //     lastSyncedStateRef.current = updatedQuiz;
//   //   //   }
//   //   // });
    
//   //   // Handle cursor movements
//   //   // socket.on('cursor-move', (data: { userId: string, x: number, y: number }) => {
//   //   //   setActiveUsers(users => 
//   //   //     users.map(user => 
//   //   //       user.id === data.userId 
//   //   //         ? { ...user, cursor: { x: data.x, y: data.y }, lastActivity: Date.now() } 
//   //   //         : user
//   //   //     )
//   //   //   );
//   //   // });
    
//   //   // Clean up socket connection on unmount
//   //   return () => {
//   //     if (socket) {
//   //       socket.emit('leave-room', { quizId, userId: currentUserRef.current.id });
//   //       socket.disconnect();
//   //     }
//   //   };
//   // }, [quizId]);
  
//   // Send cursor position periodically
//   useEffect(() => {
//     // if (!socketRef.current || !quizId) return;
    
//     // const handleMouseMove = (e: MouseEvent) => {
//     //   if (socketRef.current && showCursors) {
//     //     socketRef.current.emit('cursor-move', {
//     //       quizId,
//     //       userId: currentUserRef.current.id,
//     //       x: e.clientX,
//     //       y: e.clientY
//     //     });
//     //   }
//     // };
    
//     // Throttle mouse movement events
//     let lastEmitTime = 0;
//     const throttledMouseMove = (e: MouseEvent) => {
//       const now = Date.now();
//       if (now - lastEmitTime > 50) { // Send at most every 50ms
//         // handleMouseMove(e);
//         lastEmitTime = now;
//       }
//     };
    
//     window.addEventListener('mousemove', throttledMouseMove);
    
//     return () => {
//       window.removeEventListener('mousemove', throttledMouseMove);
//     };
//   }, [quizId, showCursors]);
  
//   // Send quiz updates to other users
//   // const broadcastQuizUpdate = () => {
//   //   if (socketRef.current && quizId) {
//   //     const quizData = {
//   //       title,
//   //       description,
//   //       questions
//   //     };
      
//   //     // Only send if data has changed
//   //     if (JSON.stringify(quizData) !== JSON.stringify(lastSyncedStateRef.current)) {
//   //       socketRef.current.emit('quiz-update', {
//   //         quizId,
//   //         quiz: quizData,
//   //         userId: currentUserRef.current.id
//   //       });
//   //       lastSyncedStateRef.current = quizData;
//   //     }
//   //   }
//   // };
  
//   // Debounced broadcast of quiz updates
//   // useEffect(() => {
//   //   const debounceTimeout = setTimeout(() => {
//   //     broadcastQuizUpdate();
//   //   }, 500);
    
//   //   return () => clearTimeout(debounceTimeout);
//   // }, [title, description, questions]);

//   useEffect(() => {
//     // Check if we're in edit mode based on the URL path
//     if (pathname.includes('/edit/')) {
//       const id = pathname.split('/').pop();
//       setQuizId(id || null);
//       if (id) {
//         console.log("id", id);
//         fetchQuizData(id);
        
//         // Set up share link
//         const baseUrl = window.location.origin;
//         setShareLink(`${baseUrl}/quiz/edit/${id}`);
//       }
//     }
//   }, [pathname]);

//   const fetchQuizData = async (id: string) => {
//     setIsLoading(true);
//     setErrorMessage(null);
    
//     try {
//       console.log("quiz--id", id);
//       const response = await fetch(`/api/quizzes/${id}`);
      
//       if (!response.ok) {
//         throw new Error(`Failed to fetch quiz: ${response.status}`);
//       }
      
//       const data = await response.json();
//       setTitle(data.title);
//       setDescription(data.description);
//       setQuestions(data.questions);
//       setIsEditing(true);
      
//       // Update last synced state
//       lastSyncedStateRef.current = {
//         title: data.title,
//         description: data.description,
//         questions: data.questions
//       };
//     } catch (error) {
//       console.error('Failed to fetch quiz:', error);
//       setErrorMessage('Failed to load quiz data. Please try again.');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const createNewQuestion = (type: QuestionType) => {
//     const template = questionTemplates[type];
//     const newQuestion: Question = {
//       id: uuidv4(),
//       type,
//       text: '',
//       options: Array(template.minOptions).fill(null).map(() => ({
//         id: uuidv4(),
//         text: '',
//         isCorrect: false,
//       })),
//       timeLimit: template.defaultTimeLimit,
//       marks: template.defaultMarks,
//       order: questions.length,
//     };
//     setQuestions([...questions, newQuestion]);
//   };

//   const updateQuestion = (questionId: string, updates: Partial<Question>) => {
//     setQuestions(questions.map(q => 
//       q.id === questionId ? { ...q, ...updates } : q
//     ));
//   };

//   const deleteQuestion = (questionId: string) => {
//     setQuestions(questions.filter(q => q.id !== questionId));
//   };

//   const duplicateQuestion = (questionId: string) => {
//     const questionToDuplicate = questions.find(q => q.id === questionId);
//     if (questionToDuplicate) {
//       const duplicatedQuestion = {
//         ...questionToDuplicate,
//         id: uuidv4(),
//         options: questionToDuplicate.options.map(opt => ({
//           ...opt,
//           id: uuidv4(),
//         })),
//         order: questions.length,
//       };
//       setQuestions([...questions, duplicatedQuestion]);
//     }
//   };

//   const addOption = (questionId: string) => {
//     setQuestions(questions.map(q => {
//       if (q.id === questionId) {
//         return {
//           ...q,
//           options: [...q.options, { id: uuidv4(), text: '', isCorrect: false }],
//         };
//       }
//       return q;
//     }));
//   };

//   const deleteOption = (questionId: string, optionId: string) => {
//     setQuestions(questions.map(q => {
//       if (q.id === questionId) {
//         return {
//           ...q,
//           options: q.options.filter(opt => opt.id !== optionId),
//         };
//       }
//       return q;
//     }));
//   };

//   const updateOption = (
//     questionId: string,
//     optionId: string,
//     updates: Partial<Option>
//   ) => {
//     setQuestions(questions.map(q => {
//       if (q.id === questionId) {
//         return {
//           ...q,
//           options: q.options.map(opt =>
//             opt.id === optionId ? { ...opt, ...updates } : opt
//           ),
//         };
//       }
//       return q;
//     }));
//   };

//   const saveQuiz = async () => {
//     setIsLoading(true);
//     setErrorMessage(null);
    
//     try {
//       console.log("quiz-id", quizId);
//       const endpoint = isEditing ? `/api/quizzes/${quizId}` : '/api/quizzes';
//       const method = isEditing ? 'PUT' : 'POST';
      
//       const response = await fetch(endpoint, {
//         method,
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           title,
//           description,
//           questions,
//           createdBy: 'current-user-id', // Replace with actual user ID
//         }),
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to save quiz: ${response.status}`);
//       }

//       // If creating a new quiz, get the ID for collaboration
//       if (!isEditing) {
//         const data = await response.json();
//         setQuizId(data._id);
//         setIsEditing(true);
        
//         // Update the URL without page reload
//         window.history.pushState({}, '', `/quiz/edit/${data._id}`);
        
//         // Set up share link
//         const baseUrl = window.location.origin;
//         setShareLink(`${baseUrl}/quiz/edit/${data._id}`);
//       }
      
//       // Show share dialog after saving
//       // setShareDialogOpen(true); 
//     } catch (error) {
//       console.error('Failed to save quiz:', error);
//       setErrorMessage('Failed to save quiz. Please try again.');
//     } finally {
//       setIsLoading(false);
//     }
//     router.push('/dashboard');
//   };

//   const copyShareLink = () => {
//     navigator.clipboard.writeText(shareLink);
//     // You could add a toast notification here
//   };

//   if (isLoading && isEditing && !quizId) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
//           <p>Loading quiz data...</p>
//         </div>
//       </div>
//     );
//   }

//   if (errorMessage) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
//           <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
//           <h2 className="text-xl font-bold mb-2">Error</h2>
//           <p className="mb-4">{errorMessage}</p>
//           <Link href="/dashboard">
//             <Button>Return to Dashboard</Button>
//           </Link>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <TooltipProvider>
//       <div className="min-h-screen bg-gray-50 relative">
//         {/* User Cursors */}
//         {showCursors && activeUsers.map(user => (
//           <div 
//             key={user.id}
//             className="fixed pointer-events-none z-50"
//             style={{ 
//               left: user.cursor.x, 
//               top: user.cursor.y,
//               display: Date.now() - user.lastActivity < 10000 ? 'block' : 'none' // Hide if inactive for 10s
//             }}
//           >
//             <div className={`h-4 w-4 ${user.color} transform rotate-45`}>
//               <div className="absolute -mt-6 -ml-1 whitespace-nowrap bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
//                 {user.name}
//               </div>
//             </div>
//           </div>
//         ))}
        
//         <div className="max-w-6xl mx-auto p-6">
//           {/* Header with Back Button */}
//           <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-6">
//             <div className="flex items-center">
//               <Link href="/dashboard">
//                 <Button variant="ghost" className="mr-4">
//                   <ArrowLeft className="h-4 w-4 mr-2" />
//                   Back to Dashboard
//                 </Button>
//               </Link>
//               <h1 className="text-2xl font-bold">
//                 {isEditing ? 'Edit Quiz' : 'Create New Quiz'}
//               </h1>
//             </div>
            
//             {/* Collaboration Controls */}
//             <div className="flex items-center space-x-2">
//               {/* Active Users */}
//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   <div className="flex -space-x-2">
//                     {activeUsers.slice(0, 3).map(user => (
//                       <Avatar key={user.id} className="border-2 border-white h-8 w-8">
//                         <AvatarFallback className={user.color}>
//                           {user.name.substring(0, 2).toUpperCase()}
//                         </AvatarFallback>
//                       </Avatar>
//                     ))}
//                     {activeUsers.length > 3 && (
//                       <Avatar className="border-2 border-white h-8 w-8">
//                         <AvatarFallback className="bg-gray-300">
//                           +{activeUsers.length - 3}
//                         </AvatarFallback>
//                       </Avatar>
//                     )}
//                   </div>
//                 </TooltipTrigger>
//                 <TooltipContent>
//                   <p>Active collaborators: {activeUsers.length}</p>
//                 </TooltipContent>
//               </Tooltip>
              
//               {/* Toggle Cursor Visibility */}
//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   <Button 
//                     variant="outline" 
//                     size="sm" 
//                     onClick={() => setShowCursors(!showCursors)}
//                   >
//                     <Users className="h-4 w-4" />
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent>
//                   <p>{showCursors ? 'Hide' : 'Show'} collaborator cursors</p>
//                 </TooltipContent>
//               </Tooltip>
              
//               {/* Share Button */}
//               {quizId && (
//                 <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
//                   <DialogTrigger asChild>
//                     <Button variant="outline" size="sm">
//                       <Share2 className="h-4 w-4 mr-2" />
//                       Share
//                     </Button>
//                   </DialogTrigger>
//                   <DialogContent>
//                     <DialogHeader>
//                       <DialogTitle>Share Quiz for Collaboration</DialogTitle>
//                       <DialogDescription>
//                         Anyone with this link can collaborate on this quiz in real-time.
//                       </DialogDescription>
//                     </DialogHeader>
//                     <div className="flex items-center mt-4">
//                       <Input 
//                         value={shareLink} 
//                         readOnly 
//                         className="mr-2"
//                       />
//                       <Button variant="outline" onClick={copyShareLink}>
//                         Copy
//                       </Button>
//                     </div>
//                   </DialogContent>
//                 </Dialog>
//               )}
//             </div>
//           </div>
          
//           {/* Quiz Title Section */}
//           <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
//             <Input
//               placeholder="Quiz Title"
//               value={title}
//               onChange={(e) => setTitle(e.target.value)}
//               className="text-2xl font-bold mb-4"
//             />
//             <Input
//               placeholder="Quiz Description"
//               value={description}
//               onChange={(e) => setDescription(e.target.value)}
//             />
//           </div>

//           {/* Questions Section */}
//           <div className="space-y-6">
//             {questions.map((question, index) => (
//               <div key={question.id} className="bg-white rounded-lg shadow-sm p-6">
//                 <div className="flex justify-between items-start mb-4">
//                   <div className="flex-1 mr-4">
//                     <Input
//                       placeholder="Question Text"
//                       value={question.text}
//                       onChange={(e) =>
//                         updateQuestion(question.id, { text: e.target.value })
//                       }
//                       className="mb-4"
//                     />
                    
//                     {/* Question Type Badge */}
//                     <div className="mb-4">
//                       <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
//                         {question.type}
//                       </span>
//                     </div>
                    
//                     {/* Options */}
//                     <div className="space-y-2 ml-4">
//                       {question.options.map((option) => (
//                         <div key={option.id} className="flex items-center gap-2">
//                           <Input
//                             placeholder="Option Text"
//                             value={option.text}
//                             onChange={(e) =>
//                               updateOption(question.id, option.id, {
//                                 text: e.target.value,
//                               })
//                             }
//                             className="flex-1"
//                           />
//                           <Button
//                             variant={option.isCorrect ? "default" : "outline"}
//                             onClick={() =>
//                               updateOption(question.id, option.id, {
//                                 isCorrect: !option.isCorrect,
//                               })
//                             }
//                             className="w-24"
//                           >
//                             {option.isCorrect ? "Correct" : "Wrong"}
//                           </Button>
//                           <Button
//                             variant="ghost"
//                             onClick={() => deleteOption(question.id, option.id)}
//                             disabled={question.options.length <= 
//                               (question.type === 'TRUE_FALSE' ? 2 : 
//                                question.type === 'MCQ' ? 2 : 3)}
//                           >
//                             <Trash2 className="h-4 w-4" />
//                           </Button>
//                         </div>
//                       ))}
//                     </div>

//                     <Button
//                       variant="outline"
//                       onClick={() => addOption(question.id)}
//                       className="mt-2 ml-4"
//                       disabled={question.type === 'TRUE_FALSE' && question.options.length >= 2}
//                     >
//                       Add Option
//                     </Button>
//                   </div>

//                   {/* Question Actions */}
//                   <div className="flex flex-col gap-2">
//                     <Button
//                       variant="ghost"
//                       onClick={() => duplicateQuestion(question.id)}
//                     >
//                       <Copy className="h-4 w-4" />
//                     </Button>
//                     <Button
//                       variant="ghost"
//                       onClick={() => deleteQuestion(question.id)}
//                     >
//                       <Trash2 className="h-4 w-4" />
//                     </Button>
//                     <div className="flex items-center gap-2">
//                       <Clock className="h-4 w-4" />
//                       <Input
//                         type="number"
//                         value={question.timeLimit}
//                         onChange={(e) =>
//                           updateQuestion(question.id, {
//                             timeLimit: parseInt(e.target.value) || 0,
//                           })
//                         }
//                         className="w-16"
//                         min="5"
//                         max="300"
//                       />
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>

//           {/* Empty State */}
//           {questions.length === 0 && (
//             <div className="bg-white rounded-lg shadow-sm p-8 text-center">
//               <h3 className="text-lg font-medium mb-2">No questions yet</h3>
//               <p className="text-gray-500 mb-4">
//                 Add questions using the panel on the left
//               </p>
//             </div>
//           )}

//           {/* Question Type Sidebar */}
//           <div className="fixed left-4 top-1/4 transform -translate-y-1/2 bg-white p-4 rounded-lg shadow-lg w-48">
//             <h3 className="text-sm font-semibold mb-4">Add Question</h3>
//             <div className="space-y-2">
//               {Object.entries(questionTemplates).map(([type]) => (
//                 <Button
//                   key={type}
//                   className="w-full"
//                   variant="outline"
//                   onClick={() => createNewQuestion(type as QuestionType)}
//                 >
//                   {type}
//                 </Button>
//               ))}
//             </div>
//           </div>

//           {/* Save Button */}
//           <div className="fixed bottom-6 right-6">
//             <Button
//               onClick={saveQuiz}
//               className="px-6"
//               disabled={!title || questions.length === 0 || isLoading}
//             >
//               {isLoading ? (
//                 <>
//                   <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
//                   {isEditing ? 'Updating...' : 'Saving...'}
//                 </>
//               ) : (
//                 <>
//                   <Save className="h-4 w-4 mr-2" />
//                   {isEditing ? 'Update Quiz' : 'Save Quiz'}
//                 </>
//               )}
//             </Button>
//           </div>
//         </div>
//       </div>
//     </TooltipProvider>
//   );
// }


// // app/quiz/create/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import { useRouter, usePathname } from 'next/navigation';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { 
//   Trash2, 
//   Copy, 
//   Clock,
//   AlertCircle,
//   Save,
//   ArrowLeft,
//   GripVertical
// } from 'lucide-react';
// import { Question, QuestionType, Option } from '@/types/quiz';
// import { v4 as uuidv4 } from 'uuid';
// import Link from 'next/link';
// import {
//   DndContext,
//   closestCenter,
//   KeyboardSensor,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   DragEndEvent
// } from '@dnd-kit/core';
// import {
//   arrayMove,
//   SortableContext,
//   sortableKeyboardCoordinates,
//   useSortable,
//   verticalListSortingStrategy
// } from '@dnd-kit/sortable';
// import { CSS } from '@dnd-kit/utilities';

// interface QuestionTemplate {
//   type: QuestionType;
//   defaultTimeLimit: number;
//   minOptions: number;
// }

// const questionTemplates: Record<QuestionType, QuestionTemplate> = {
//   MCQ: {
//     type: 'MCQ',
//     defaultTimeLimit: 30,
//     minOptions: 4,
//   },
//   TRUE_FALSE: {
//     type: 'TRUE_FALSE',
//     defaultTimeLimit: 15,
//     minOptions: 2,
//   },
//   MULTIPLE_CORRECT: {
//     type: 'MULTIPLE_CORRECT',
//     defaultTimeLimit: 45,
//     minOptions: 5,
//   },
// };

// interface SortableQuestionProps {
//   question: Question;
//   updateQuestion: (questionId: string, updates: Partial<Question>) => void;
//   deleteQuestion: (questionId: string) => void;
//   duplicateQuestion: (questionId: string) => void;
//   addOption: (questionId: string) => void;
//   deleteOption: (questionId: string, optionId: string) => void;
//   updateOption: (questionId: string, optionId: string, updates: Partial<Option>) => void;
// }

// const SortableQuestion = ({
//   question,
//   updateQuestion,
//   deleteQuestion,
//   duplicateQuestion,
//   addOption,
//   deleteOption,
//   updateOption,
// }: SortableQuestionProps) => {
//   const {
//     attributes,
//     listeners,
//     setNodeRef,
//     transform,
//     transition,
//     isDragging
//   } = useSortable({ id: question.id });

//   const style = {
//     transform: CSS.Transform.toString(transform),
//     transition,
//     opacity: isDragging ? 0.6 : 1,
//     zIndex: isDragging ? 1 : 0
//   };

//   return (
//     <div 
//       ref={setNodeRef} 
//       style={style} 
//       className="bg-white rounded-lg shadow-sm p-6 relative"
//     >
//       {/* Drag Handle */}
//       <div 
//         {...attributes} 
//         {...listeners}
//         className="absolute left-2 top-1/2 transform -translate-y-1/2 cursor-grab p-2 hover:bg-gray-100 rounded-md"
//       >
//         <GripVertical className="h-5 w-5 text-gray-400" />
//       </div>

//       <div className="flex justify-between items-start mb-4 pl-8">
//         <div className="flex-1 mr-4">
//           <Input
//             placeholder="Question Text"
//             value={question.text}
//             onChange={(e) =>
//               updateQuestion(question.id, { text: e.target.value })
//             }
//             className="mb-4"
//           />
          
//           {/* Question Type Badge */}
//           <div className="mb-4">
//             <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
//               {question.type}
//             </span>
//           </div>
          
//           {/* Options */}
//           <div className="space-y-2 ml-4">
//             {question.options.map((option) => (
//               <div key={option.id} className="flex items-center gap-2">
//                 <Input
//                   placeholder="Option Text"
//                   value={option.text}
//                   onChange={(e) =>
//                     updateOption(question.id, option.id, {
//                       text: e.target.value,
//                     })
//                   }
//                   className="flex-1"
//                 />
//                 <Button
//                   variant={option.isCorrect ? "default" : "outline"}
//                   onClick={() =>
//                     updateOption(question.id, option.id, {
//                       isCorrect: !option.isCorrect,
//                     })
//                   }
//                   className="w-24"
//                 >
//                   {option.isCorrect ? "Correct" : "Wrong"}
//                 </Button>
//                 <Button
//                   variant="ghost"
//                   onClick={() => deleteOption(question.id, option.id)}
//                   disabled={question.options.length <= 
//                     (question.type === 'TRUE_FALSE' ? 2 : 
//                      question.type === 'MCQ' ? 2 : 3)}
//                 >
//                   <Trash2 className="h-4 w-4" />
//                 </Button>
//               </div>
//             ))}
//           </div>

//           <Button
//             variant="outline"
//             onClick={() => addOption(question.id)}
//             className="mt-2 ml-4"
//             disabled={question.type === 'TRUE_FALSE' && question.options.length >= 2}
//           >
//             Add Option
//           </Button>
//         </div>

//         {/* Question Actions */}
//         <div className="flex flex-col gap-2">
//           <Button
//             variant="ghost"
//             onClick={() => duplicateQuestion(question.id)}
//           >
//             <Copy className="h-4 w-4" />
//           </Button>
//           <Button
//             variant="ghost"
//             onClick={() => deleteQuestion(question.id)}
//           >
//             <Trash2 className="h-4 w-4" />
//           </Button>
//           <div className="flex items-center gap-2">
//             <Clock className="h-4 w-4" />
//             <Input
//               type="number"
//               value={question.timeLimit}
//               onChange={(e) =>
//                 updateQuestion(question.id, {
//                   timeLimit: parseInt(e.target.value) || 0,
//                 })
//               }
//               className="w-16"
//               min="5"
//               max="300"
//             />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default function QuizEditor() {
//   const router = useRouter();
//   const pathname = usePathname();
//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [questions, setQuestions] = useState<Question[]>([]);
//   const [isEditing, setIsEditing] = useState(false);
//   const [quizId, setQuizId] = useState<string | null>(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);

//   // Setup DnD sensors
//   const sensors = useSensors(
//     useSensor(PointerSensor, {
//       activationConstraint: {
//         distance: 8,
//       },
//     }),
//     useSensor(KeyboardSensor, {
//       coordinateGetter: sortableKeyboardCoordinates,
//     })
//   );

//   useEffect(() => {
//     // Check if we're in edit mode based on the URL path
//     if (pathname.includes('/edit/')) {
//       const id = pathname.split('/').pop();
//       setQuizId(id || null);
//       if (id) {
//         fetchQuizData(id);
//       }
//     }
//   }, [pathname]);

//   const fetchQuizData = async (id: string) => {
//     setIsLoading(true);
//     setErrorMessage(null);
    
//     try {
//       const response = await fetch(`/api/quizzes/${id}`);
      
//       if (!response.ok) {
//         throw new Error(`Failed to fetch quiz: ${response.status}`);
//       }
      
//       const data = await response.json();
//       setTitle(data.title);
//       setDescription(data.description);
      
//       // Ensure questions have an order property
//       const questionsWithOrder = data.questions.map((q: Question, index: number) => ({
//         ...q,
//         order: q.order !== undefined ? q.order : index
//       }));
      
//       // Sort questions by order
//       const sortedQuestions = [...questionsWithOrder].sort((a, b) => a.order - b.order);
//       setQuestions(sortedQuestions);
      
//       setIsEditing(true);
//     } catch (error) {
//       console.error('Failed to fetch quiz:', error);
//       setErrorMessage('Failed to load quiz data. Please try again.');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleDragEnd = (event: DragEndEvent) => {
//     const { active, over } = event;
    
//     if (over && active.id !== over.id) {
//       setQuestions((items) => {
//         const oldIndex = items.findIndex((item) => item.id === active.id);
//         const newIndex = items.findIndex((item) => item.id === over.id);
        
//         // Move the item in the array
//         const newArray = arrayMove(items, oldIndex, newIndex);
        
//         // Update order property of each question
//         return newArray.map((item, index) => ({
//           ...item,
//           order: index
//         }));
//       });
//     }
//   };

//   const createNewQuestion = (type: QuestionType) => {
//     const template = questionTemplates[type];
//     const newQuestion: Question = {
//       id: uuidv4(),
//       type,
//       text: '',
//       options: Array(template.minOptions).fill(null).map(() => ({
//         id: uuidv4(),
//         text: '',
//         isCorrect: false,
//       })),
//       timeLimit: template.defaultTimeLimit,
//       order: questions.length,
//     };
//     setQuestions([...questions, newQuestion]);
//   };

//   const updateQuestion = (questionId: string, updates: Partial<Question>) => {
//     setQuestions(questions.map(q => 
//       q.id === questionId ? { ...q, ...updates } : q
//     ));
//   };

//   const deleteQuestion = (questionId: string) => {
//     const updatedQuestions = questions
//       .filter(q => q.id !== questionId)
//       .map((q, index) => ({ ...q, order: index }));
    
//     setQuestions(updatedQuestions);
//   };

//   const duplicateQuestion = (questionId: string) => {
//     const questionToDuplicate = questions.find(q => q.id === questionId);
//     if (questionToDuplicate) {
//       const duplicatedQuestion = {
//         ...questionToDuplicate,
//         id: uuidv4(),
//         options: questionToDuplicate.options.map(opt => ({
//           ...opt,
//           id: uuidv4(),
//         })),
//         order: questions.length,
//       };
//       setQuestions([...questions, duplicatedQuestion]);
//     }
//   };

//   const addOption = (questionId: string) => {
//     setQuestions(questions.map(q => {
//       if (q.id === questionId) {
//         return {
//           ...q,
//           options: [...q.options, { id: uuidv4(), text: '', isCorrect: false }],
//         };
//       }
//       return q;
//     }));
//   };

//   const deleteOption = (questionId: string, optionId: string) => {
//     setQuestions(questions.map(q => {
//       if (q.id === questionId) {
//         return {
//           ...q,
//           options: q.options.filter(opt => opt.id !== optionId),
//         };
//       }
//       return q;
//     }));
//   };

//   const updateOption = (
//     questionId: string,
//     optionId: string,
//     updates: Partial<Option>
//   ) => {
//     setQuestions(questions.map(q => {
//       if (q.id === questionId) {
//         return {
//           ...q,
//           options: q.options.map(opt =>
//             opt.id === optionId ? { ...opt, ...updates } : opt
//           ),
//         };
//       }
//       return q;
//     }));
//   };

//   const saveQuiz = async () => {
//     setIsLoading(true);
//     setErrorMessage(null);
    
//     try {
//       const endpoint = isEditing ? `/api/quizzes/${quizId}` : '/api/quizzes';
//       const method = isEditing ? 'PUT' : 'POST';
      
//       // Make sure the order property is set correctly for all questions
//       const orderedQuestions = questions.map((q, index) => ({
//         ...q,
//         order: index
//       }));
      
//       const response = await fetch(endpoint, {
//         method,
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           title,
//           description,
//           questions: orderedQuestions,
//           createdBy: 'current-user-id', // Replace with actual user ID
//         }),
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to save quiz: ${response.status}`);
//       }

//       router.push('/dashboard');
//     } catch (error) {
//       console.error('Failed to save quiz:', error);
//       setErrorMessage('Failed to save quiz. Please try again.');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   if (isLoading && isEditing) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
//           <p>Loading quiz data...</p>
//         </div>
//       </div>
//     );
//   }

//   if (errorMessage) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
//           <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
//           <h2 className="text-xl font-bold mb-2">Error</h2>
//           <p className="mb-4">{errorMessage}</p>
//           <Link href="/dashboard">
//             <Button>Return to Dashboard</Button>
//           </Link>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <div className="max-w-6xl mx-auto p-6">
//         {/* Header with Back Button */}
//         <div className="flex items-center mb-6">
//           <Link href="/dashboard">
//             <Button variant="ghost" className="mr-4">
//               <ArrowLeft className="h-4 w-4 mr-2" />
//               Back to Dashboard
//             </Button>
//           </Link>
//           <h1 className="text-2xl font-bold">
//             {isEditing ? 'Edit Quiz' : 'Create New Quiz'}
//           </h1>
//         </div>
        
//         {/* Quiz Title Section */}
//         <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
//           <Input
//             placeholder="Quiz Title"
//             value={title}
//             onChange={(e) => setTitle(e.target.value)}
//             className="text-2xl font-bold mb-4"
//           />
//           <Input
//             placeholder="Quiz Description"
//             value={description}
//             onChange={(e) => setDescription(e.target.value)}
//           />
//         </div>

//         {/* Questions Section with Drag and Drop */}
//         <DndContext
//           sensors={sensors}
//           collisionDetection={closestCenter}
//           onDragEnd={handleDragEnd}
//         >
//           <div className="space-y-4">
//             {questions.length > 0 && (
//               <div className="bg-blue-50 p-3 rounded-lg text-blue-700 text-sm mb-4 flex items-center">
//                 <AlertCircle className="h-4 w-4 mr-2" />
//                 <span>Drag and drop questions to reorder them</span>
//               </div>
//             )}
            
//             <SortableContext 
//               items={questions.map(q => q.id)}
//               strategy={verticalListSortingStrategy}
//             >
//               <div className="space-y-6">
//                 {questions.map((question) => (
//                   <SortableQuestion
//                     key={question.id}
//                     question={question}
//                     updateQuestion={updateQuestion}
//                     deleteQuestion={deleteQuestion}
//                     duplicateQuestion={duplicateQuestion}
//                     addOption={addOption}
//                     deleteOption={deleteOption}
//                     updateOption={updateOption}
//                   />
//                 ))}
//               </div>
//             </SortableContext>
//           </div>
//         </DndContext>

//         {/* Empty State */}
//         {questions.length === 0 && (
//           <div className="bg-white rounded-lg shadow-sm p-8 text-center">
//             <h3 className="text-lg font-medium mb-2">No questions yet</h3>
//             <p className="text-gray-500 mb-4">
//               Add questions using the panel on the left
//             </p>
//           </div>
//         )}

//         {/* Question Type Sidebar */}
//         <div className="fixed left-4 top-1/4 transform -translate-y-1/2 bg-white p-4 rounded-lg shadow-lg w-48">
//           <h3 className="text-sm font-semibold mb-4">Add Question</h3>
//           <div className="space-y-2">
//             {Object.entries(questionTemplates).map(([type]) => (
//               <Button
//                 key={type}
//                 className="w-full"
//                 variant="outline"
//                 onClick={() => createNewQuestion(type as QuestionType)}
//               >
//                 {type}
//               </Button>
//             ))}
//           </div>
//         </div>

//         {/* Save Button */}
//         <div className="fixed bottom-6 right-6">
//           <Button
//             onClick={saveQuiz}
//             className="px-6"
//             disabled={!title || questions.length === 0 || isLoading}
//           >
//             {isLoading ? (
//               <>
//                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
//                 {isEditing ? 'Updating...' : 'Saving...'}
//               </>
//             ) : (
//               <>
//                 <Save className="h-4 w-4 mr-2" />
//                 {isEditing ? 'Update Quiz' : 'Save Quiz'}
//               </>
//             )}
//           </Button>
//         </div>
//       </div>
//     </div>
//   );
// }






// 'use client';

// import { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { 
//   Trash2, 
//   Copy, 
//   Clock,
//   AlertCircle
// } from 'lucide-react';
// import { Question, QuestionType, Option } from '@/types/quiz';
// import { v4 as uuidv4 } from 'uuid';

// interface QuestionTemplate {
//   type: QuestionType;
//   defaultTimeLimit: number;
//   minOptions: number;
// }

// const questionTemplates: Record<QuestionType, QuestionTemplate> = {
//   MCQ: {
//     type: 'MCQ',
//     defaultTimeLimit: 30,
//     minOptions: 4,
//   },
//   TRUE_FALSE: {
//     type: 'TRUE_FALSE',
//     defaultTimeLimit: 15,
//     minOptions: 2,
//   },
//   MULTIPLE_CORRECT: {
//     type: 'MULTIPLE_CORRECT',
//     defaultTimeLimit: 45,
//     minOptions: 5,
//   },
// };

// export default function QuizEditor() {
//   const router = useRouter();
//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [questions, setQuestions] = useState<Question[]>([]);
//   const [isEditing, setIsEditing] = useState(false);
//   const [quizId, setQuizId] = useState<string | null>(null);

//   useEffect(() => {
//     // If we're in edit mode, fetch the quiz data
//     const path = window.location.pathname;
//     if (path.includes('/edit/')) {
//       const id = path.split('/').pop();
//       setQuizId(id || null);
//       fetchQuizData(id);
//     }
//   }, []);

//   const fetchQuizData = async (id: string | undefined) => {
//     if (!id) return;
//     try {
//       const response = await fetch(`/api/quizzes/${id}`);
//       const data = await response.json();
//       setTitle(data.title);
//       setDescription(data.description);
//       setQuestions(data.questions);
//       setIsEditing(true);
//     } catch (error) {
//       console.error('Failed to fetch quiz:', error);
//     }
//   };

//   const createNewQuestion = (type: QuestionType) => {
//     const template = questionTemplates[type];
//     const newQuestion: Question = {
//       id: uuidv4(),
//       type,
//       text: '',
//       options: Array(template.minOptions).fill(null).map(() => ({
//         id: uuidv4(),
//         text: '',
//         isCorrect: false,
//       })),
//       timeLimit: template.defaultTimeLimit,
//       order: questions.length,
//     };
//     setQuestions([...questions, newQuestion]);
//   };

//   const updateQuestion = (questionId: string, updates: Partial<Question>) => {
//     setQuestions(questions.map(q => 
//       q.id === questionId ? { ...q, ...updates } : q
//     ));
//   };

//   const deleteQuestion = (questionId: string) => {
//     setQuestions(questions.filter(q => q.id !== questionId));
//   };

//   const duplicateQuestion = (questionId: string) => {
//     const questionToDuplicate = questions.find(q => q.id === questionId);
//     if (questionToDuplicate) {
//       const duplicatedQuestion = {
//         ...questionToDuplicate,
//         id: uuidv4(),
//         options: questionToDuplicate.options.map(opt => ({
//           ...opt,
//           id: uuidv4(),
//         })),
//         order: questions.length,
//       };
//       setQuestions([...questions, duplicatedQuestion]);
//     }
//   };

//   const addOption = (questionId: string) => {
//     setQuestions(questions.map(q => {
//       if (q.id === questionId) {
//         return {
//           ...q,
//           options: [...q.options, { id: uuidv4(), text: '', isCorrect: false }],
//         };
//       }
//       return q;
//     }));
//   };

//   const deleteOption = (questionId: string, optionId: string) => {
//     setQuestions(questions.map(q => {
//       if (q.id === questionId) {
//         return {
//           ...q,
//           options: q.options.filter(opt => opt.id !== optionId),
//         };
//       }
//       return q;
//     }));
//   };

//   const updateOption = (
//     questionId: string,
//     optionId: string,
//     updates: Partial<Option>
//   ) => {
//     setQuestions(questions.map(q => {
//       if (q.id === questionId) {
//         return {
//           ...q,
//           options: q.options.map(opt =>
//             opt.id === optionId ? { ...opt, ...updates } : opt
//           ),
//         };
//       }
//       return q;
//     }));
//   };

//   const saveQuiz = async () => {
//     try {
//       const endpoint = isEditing ? `/api/quizzes/${quizId}` : '/api/quizzes';
//       const method = isEditing ? 'PUT' : 'POST';
      
//       const response = await fetch(endpoint, {
//         method,
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           title,
//           description,
//           questions,
//           createdBy: 'current-user-id', // Replace with actual user ID
//         }),
//       });

//       if (response.ok) {
//         router.push('/dashboard');
//       }
//     } catch (error) {
//       console.error('Failed to save quiz:', error);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <div className="max-w-6xl mx-auto p-6">
//         {/* Quiz Title Section */}
//         <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
//           <Input
//             placeholder="Quiz Title"
//             value={title}
//             onChange={(e) => setTitle(e.target.value)}
//             className="text-2xl font-bold mb-4"
//           />
//           <Input
//             placeholder="Quiz Description"
//             value={description}
//             onChange={(e) => setDescription(e.target.value)}
//           />
//         </div>

//         {/* Questions Section */}
//         <div className="space-y-6">
//           {questions.map((question, index) => (
//             <div key={question.id} className="bg-white rounded-lg shadow-sm p-6">
//               <div className="flex justify-between items-start mb-4">
//                 <div className="flex-1 mr-4">
//                   <Input
//                     placeholder="Question Text"
//                     value={question.text}
//                     onChange={(e) =>
//                       updateQuestion(question.id, { text: e.target.value })
//                     }
//                     className="mb-4"
//                   />
                  
//                   {/* Options */}
//                   <div className="space-y-2 ml-4">
//                     {question.options.map((option) => (
//                       <div key={option.id} className="flex items-center gap-2">
//                         <Input
//                           placeholder="Option Text"
//                           value={option.text}
//                           onChange={(e) =>
//                             updateOption(question.id, option.id, {
//                               text: e.target.value,
//                             })
//                           }
//                           className="flex-1"
//                         />
//                         <Button
//                           variant={option.isCorrect ? "default" : "outline"}
//                           onClick={() =>
//                             updateOption(question.id, option.id, {
//                               isCorrect: !option.isCorrect,
//                             })
//                           }
//                           className="w-24"
//                         >
//                           {option.isCorrect ? "Correct" : "Wrong"}
//                         </Button>
//                         <Button
//                           variant="ghost"
//                           onClick={() => deleteOption(question.id, option.id)}
//                           disabled={question.options.length <= 2}
//                         >
//                           <Trash2 className="h-4 w-4" />
//                         </Button>
//                       </div>
//                     ))}
//                   </div>

//                   <Button
//                     variant="outline"
//                     onClick={() => addOption(question.id)}
//                     className="mt-2 ml-4"
//                   >
//                     Add Option
//                   </Button>
//                 </div>

//                 {/* Question Actions */}
//                 <div className="flex flex-col gap-2">
//                   <Button
//                     variant="ghost"
//                     onClick={() => duplicateQuestion(question.id)}
//                   >
//                     <Copy className="h-4 w-4" />
//                   </Button>
//                   <Button
//                     variant="ghost"
//                     onClick={() => deleteQuestion(question.id)}
//                   >
//                     <Trash2 className="h-4 w-4" />
//                   </Button>
//                   <div className="flex items-center gap-2">
//                     <Clock className="h-4 w-4" />
//                     <Input
//                       type="number"
//                       value={question.timeLimit}
//                       onChange={(e) =>
//                         updateQuestion(question.id, {
//                           timeLimit: parseInt(e.target.value),
//                         })
//                       }
//                       className="w-16"
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>

//         {/* Question Type Sidebar */}
//         <div className="fixed left-4 top-1/4 transform -translate-y-1/2 bg-white p-4 rounded-lg shadow-lg w-48">
//           <h3 className="text-sm font-semibold mb-4">Add Question</h3>
//           <div className="space-y-2">
//             {Object.entries(questionTemplates).map(([type]) => (
//               <Button
//                 key={type}
//                 className="w-full"
//                 variant="outline"
//                 onClick={() => createNewQuestion(type as QuestionType)}
//               >
//                 {type}
//               </Button>
//             ))}
//           </div>
//         </div>

//         {/* Save Button */}
//         <div className="fixed bottom-6 right-6">
//           <Button
//             onClick={saveQuiz}
//             className="px-6"
//             disabled={!title || questions.length === 0}
//           >
//             {isEditing ? 'Update Quiz' : 'Save Quiz'}
//           </Button>
//         </div>
//       </div>
//     </div>
//   );
// }
