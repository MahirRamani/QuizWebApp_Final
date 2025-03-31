// app/student/results/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Search, 
  BarChart, 
  PieChart, 
  Clock, 
  Calendar, 
  Award,
  Download,
  Filter
} from 'lucide-react';
import Link from 'next/link';

interface QuizResult {
  _id: string;
  quizId: string;
  quizTitle: string;
  studentName: string;
  score: number;
  totalPoints: number;
  correctAnswers: number;
  totalQuestions: number;
  timeUsed: number;
  focusLossCount: number;
  submittedAt: string;
  questionResults: {
    questionId: string;
    questionText: string;
    isCorrect: boolean;
    studentAnswer: string[];
    correctAnswer: string[];
    timeSpent: number;
  }[];
}

export default function StudentResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentName = searchParams?.get('name') || '';
  
  const [results, setResults] = useState<QuizResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<QuizResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);
  const [studentNameInput, setStudentNameInput] = useState(studentName);
  
  useEffect(() => {
    if (studentNameInput) {
      fetchResults(studentNameInput);
    }
  }, [studentNameInput]);

  useEffect(() => {
    filterResults();
  }, [searchQuery, results]);

  const fetchResults = async (name: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/student/results?name=${encodeURIComponent(name)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data);
      setFilteredResults(data);
    } catch (error) {
      console.error('Failed to fetch results:', error);
      setError('Failed to load quiz results. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterResults = () => {
    if (!searchQuery.trim()) {
      setFilteredResults(results);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = results.filter(result => 
      result.quizTitle.toLowerCase().includes(query) ||
      new Date(result.submittedAt).toLocaleDateString().includes(query)
    );
    
    setFilteredResults(filtered);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateAverageScore = (): number => {
    if (results.length === 0) return 0;
    
    const totalScorePercentage = results.reduce((sum, result) => {
      return sum + (result.score / result.totalPoints) * 100;
    }, 0);
    
    return Math.round(totalScorePercentage / results.length);
  };

  const calculateTopSubject = (): string => {
    if (results.length === 0) return 'N/A';
    
    // This is a placeholder - in a real app, you'd categorize quizzes by subject
    // and find the one with the best performance
    return 'General Knowledge';
  };

  const calculateTotalQuizzes = (): number => {
    return results.length;
  };

  const viewResultDetails = (result: QuizResult) => {
    setSelectedResult(result);
  };

  const downloadCertificate = (result: QuizResult) => {
    // In a real application, this would generate and download a PDF certificate
    alert(`Certificate for ${result.quizTitle} would be downloaded here.`);
  };

  const handleSubmitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentNameInput) {
      router.push(`/student/results?name=${encodeURIComponent(studentNameInput)}`);
      fetchResults(studentNameInput);
    }
  };

  // Return to detailed view of a single result
  if (selectedResult) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            className="mb-4"
            onClick={() => setSelectedResult(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Results
          </Button>
          
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold mb-1">{selectedResult.quizTitle}</h1>
                <p className="text-gray-500">Completed on {formatDate(selectedResult.submittedAt)}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {selectedResult.score} / {selectedResult.totalPoints}
                </div>
                <p className="text-sm text-gray-500">
                  {Math.round((selectedResult.score / selectedResult.totalPoints) * 100)}% Score
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 my-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-1">
                  <Award className="h-4 w-4 text-green-500 mr-2" />
                  <p className="text-sm text-gray-500">Correct Answers</p>
                </div>
                <p className="text-xl font-bold">
                  {selectedResult.correctAnswers} / {selectedResult.totalQuestions}
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-1">
                  <Clock className="h-4 w-4 text-amber-500 mr-2" />
                  <p className="text-sm text-gray-500">Time Used</p>
                </div>
                <p className="text-xl font-bold">{formatTime(selectedResult.timeUsed)}</p>
              </div>
              
              // app/student/results/page.tsx (continued)
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-1">
                  <Filter className="h-4 w-4 text-red-500 mr-2" />
                  <p className="text-sm text-gray-500">Focus Loss Events</p>
                </div>
                <p className="text-xl font-bold">{selectedResult.focusLossCount}</p>
              </div>
            </div>
            
            {selectedResult.score / selectedResult.totalPoints >= 0.7 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex justify-between items-center">
                <div className="flex items-center">
                  <Award className="h-6 w-6 text-green-500 mr-3" />
                  <div>
                    <h3 className="font-semibold text-green-800">Congratulations!</h3>
                    <p className="text-green-700">You've passed this quiz with a score of {Math.round((selectedResult.score / selectedResult.totalPoints) * 100)}%.</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="text-green-700 border-green-300"
                  onClick={() => downloadCertificate(selectedResult)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Get Certificate
                </Button>
              </div>
            )}
            
            <h2 className="text-xl font-semibold mb-4">Question Analysis</h2>
            
            <div className="space-y-4">
              {selectedResult.questionResults.map((qResult, index) => (
                <div 
                  key={qResult.questionId} 
                  className={`p-4 border rounded-lg ${
                    qResult.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <h3 className="font-medium">Question {index + 1}</h3>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1 text-gray-500" />
                      <span className="text-sm text-gray-500">{formatTime(qResult.timeSpent)}</span>
                    </div>
                  </div>
                  
                  <p className="mb-3">{qResult.questionText}</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Your Answer:</p>
                      <p className={qResult.isCorrect ? 'text-green-700' : 'text-red-700'}>
                        {qResult.studentAnswer.join(', ') || 'No answer provided'}
                      </p>
                    </div>
                    
                    {!qResult.isCorrect && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Correct Answer:</p>
                        <p className="text-green-700">{qResult.correctAnswer.join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Student name input form
  if (!studentName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6">View Your Quiz Results</h1>
          <form onSubmit={handleSubmitName} className="space-y-4">
            <div>
              <label htmlFor="studentName" className="block text-sm font-medium text-gray-700 mb-1">
                Enter your name
              </label>
              <Input
                id="studentName"
                placeholder="Your name"
                value={studentNameInput}
                onChange={(e) => setStudentNameInput(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" className="w-full" disabled={!studentNameInput}>
              View Results
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Link href="/quiz/join">
              <Button variant="link">
                Join a quiz instead
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
          <div className="text-red-500 mb-4">Error icon would go here</div>
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="mb-4">{error}</p>
          <Link href="/quiz/join">
            <Button>Return to Join Page</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Main results page
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Link href="/quiz/join">
              <Button variant="ghost" className="mr-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Join New Quiz
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">
              Results for {studentNameInput}
            </h1>
          </div>
        </div>
        
        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Average Score</h2>
              <BarChart className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-blue-600">{calculateAverageScore()}%</p>
            <p className="text-sm text-gray-500">Across all quizzes</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Top Subject</h2>
              <Award className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-purple-600">{calculateTopSubject()}</p>
            <p className="text-sm text-gray-500">Your strongest area</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Total Quizzes</h2>
              <PieChart className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-green-600">{calculateTotalQuizzes()}</p>
            <p className="text-sm text-gray-500">Completed quizzes</p>
          </div>
        </div>
        
        {/* Search bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Search by quiz title or date"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </div>
        
        {/* Results List */}
        {filteredResults.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-gray-400 mb-4">No results icon would go here</div>
            <h3 className="text-lg font-medium mb-2">No quiz results found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery 
                ? "No quizzes match your search criteria."
                : "You haven't completed any quizzes yet."}
            </p>
            <Link href="/quiz/join">
              <Button>Join a Quiz</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResults.map((result) => (
              <div
                key={result._id}
                className="bg-white rounded-lg shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between"
              >
                <div className="mb-4 md:mb-0">
                  <h3 className="text-lg font-semibold mb-1">{result.quizTitle}</h3>
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(result.submittedAt)}
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Score</p>
                    <p className="font-bold text-lg">
                      {Math.round((result.score / result.totalPoints) * 100)}%
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Correct</p>
                    <p className="font-bold text-lg">
                      {result.correctAnswers}/{result.totalQuestions}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="font-bold text-lg">{formatTime(result.timeUsed)}</p>
                  </div>
                  
                  <Button 
                    onClick={() => viewResultDetails(result)}
                    variant="outline"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Results counter */}
        {results.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredResults.length} of {results.length} results
          </div>
        )}
      </div>
    </div>
  );
}