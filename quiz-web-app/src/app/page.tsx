// app/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Dashboard from './dashboard/page';

export default function HomePage() {
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-4">Quiz</h1>
        <p className="text-xl text-white/90 max-w-2xl mx-auto">
          Challenge your friends in real-time quiz competitions. Create your own quizzes or join existing ones for endless learning fun.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8 mb-8">
      <Link href="/dashboard" className="block">
            <button className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">
              Dashboards
            </button>
          </Link>
        {/* <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-800">Get Started</h2>
          <p className="text-gray-600 mt-2">Join a quiz or sign in to create your own</p>
        </div>

        <div className="space-y-4">
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter quiz code"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button 
              className={`px-4 py-2 rounded-md transition-colors ${username && joinCode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              disabled={!username || !joinCode}
              onClick={() => {
                if (username && joinCode) {
                  window.location.href = `/quiz/${joinCode}?username=${encodeURIComponent(username)}`;
                }
              }}
            >
              Join
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <Link href="/da" className="block">
            <button className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">
              Sign Up / Login
            </button>
          </Link>
        </div> */}
      </div>


      <footer className="mt-12 text-center text-white/80">
        {/* <p>© {new Date().getFullYear()} QuizTime. All rights reserved.</p> */}
      </footer>
    </div>
  );
}