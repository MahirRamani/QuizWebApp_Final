// app/quiz/join/page.tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function JoinQuiz() {
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const router = useRouter();

  const handleJoin = async () => {
    if (!joinCode || !name) return;
    // Make sure joinCode is a string
    const codeString = String(joinCode).trim();
    console.log("join code", codeString);
    router.push(`/quiz/session/${codeString}`);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6">
      <h1 className="text-2xl font-bold mb-6">Join Quiz</h1>
      <div className="space-y-4">
        <Input
          placeholder="Enter join code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
        />
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          className="w-full"
          onClick={handleJoin}
          disabled={!joinCode || !name}
        >
          Join
        </Button>
      </div>
    </div>
  );
}