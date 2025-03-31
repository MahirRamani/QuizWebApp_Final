// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Quiz } from '@/types/quiz';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function Dashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    // Filter quizzes whenever search query changes
    if (searchQuery.trim() === '') {
      setFilteredQuizzes(quizzes);
    } else {
      const lowercaseQuery = searchQuery.toLowerCase();
      const filtered = quizzes.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(lowercaseQuery) ||
          quiz.joinCode.toLowerCase().includes(lowercaseQuery)
      );
      setFilteredQuizzes(filtered);
    }
  }, [searchQuery, quizzes]);

  const fetchQuizzes = async () => {
    try {
      const response = await fetch('/api/quizzes');
      const data = await response.json();
      setQuizzes(data);
      setFilteredQuizzes(data);
    } catch (error) {
      console.error('Failed to fetch quizzes:', error);
    }
  };

  const deleteQuiz = async (quizId: string) => {
    try {
      await fetch(`/api/quizzes/${quizId}`, {
        method: 'DELETE',
      });
      fetchQuizzes();
    } catch (error) {
      console.error('Failed to delete quiz:', error);
    }
  };

  const changeQuizStatus = async (quizId: string) => {
    try {
      await fetch(`/api/quizzes/status/${quizId}`, {
        method: 'PUT',
      });
      fetchQuizzes();
    } catch (error) {
      console.error('Failed to update quiz status:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quiz Dashboard</h1>
        <Link href="/quiz/create">
          <Button>Create New Quiz</Button>
        </Link>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Search quizzes"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 w-full"
        />
      </div>

      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? "No quizzes match your search" : "No quizzes available"}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredQuizzes.map((quiz) => (
            <div
              key={quiz._id.toString()}
              className="p-4 border rounded-lg flex justify-between items-center"
            >
              <div>
                <h2 className="text-xl font-semibold">{quiz.title}</h2>
                <p className="text-gray-600">Join Code: {quiz.joinCode}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/quiz/edit/${quiz._id.toString()}`}>
                  <Button variant="outline">Edit</Button>
                </Link>
                <Button
                  variant="destructive"
                  onClick={() => deleteQuiz(quiz._id.toString())}
                >
                  Delete
                </Button>
                <Button
                  variant="default"
                  onClick={() => changeQuizStatus(quiz._id.toString())}
                  disabled={quiz.isActive}
                >
                  {quiz.isActive?"Running":"Start Quiz"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results counter */}
      {quizzes.length > 0 && (
        <div className="mt-4 text-sm text-gray-500">
          Showing {filteredQuizzes.length} of {quizzes.length} quizzes
        </div>
      )}
    </div>
  );
}


// // app/dashboard/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import { Button } from '@/components/ui/button';
// import { Quiz } from '@/types/quiz';
// import Link from 'next/link';

// export default function Dashboard() {
//   const [quizzes, setQuizzes] = useState<Quiz[]>([]);

//   useEffect(() => {
//     fetchQuizzes();
//   }, []);

//   const fetchQuizzes = async () => {
//     try {
//       const response = await fetch('/api/quizzes');
//       const data = await response.json();
//       setQuizzes(data);
//     } catch (error) {
//       console.error('Failed to fetch quizzes:', error);
//     }
//   };

//   const deleteQuiz = async (quizId: string) => {
//     try {
//       await fetch(`/api/quizzes/${quizId}`, {
//         method: 'DELETE',
//       });
//       fetchQuizzes();
//     } catch (error) {
//       console.error('Failed to delete quiz:', error);
//     }
//   };

//   return (
//     <div className="p-8">
//       <div className="flex justify-between items-center mb-6">
//         <h1 className="text-2xl font-bold">Quiz Dashboard</h1>
//         <Link href="/quiz/create">
//           <Button>Create New Quiz</Button>
//         </Link>
//       </div>

//       <div className="grid gap-4">
//         {quizzes.map((quiz) => (
//           <div
//             key={quiz._id.toString()} // Using MongoDB's _id as the unique key
//             className="p-4 border rounded-lg flex justify-between items-center"
//           >
//             <div>
//               <h2 className="text-xl font-semibold">{quiz.title}</h2>
//               <p className="text-gray-600">Join Code: {quiz.joinCode}</p>
//             </div>
//             <div className="flex gap-2">
//               <Link href={`/quiz/edit/${quiz._id.toString()}`}>
//                 <Button variant="outline">Edit</Button>
//               </Link>
//               <Button
//                 variant="destructive"
//                 onClick={() => deleteQuiz(quiz._id.toString())}
//               >
//                 Delete
//               </Button>
//               <Button
//                 variant="default"
//                 disabled={quiz.isActive}
//               >
//                 Start Quiz
//               </Button>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }