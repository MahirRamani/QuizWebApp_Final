// lib/socket.ts
import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponse } from 'next';
import mongoose from 'mongoose';

// Import models directly instead of using @/models
import { Quiz } from '../models/Quiz';
import { QuizSession } from '../models/QuizSession';

// Type definitions
interface Participant {
  _id: mongoose.Types.ObjectId;
  name: string;
  score: number;
  answers: Answer[];
}

interface Answer {
  questionId: string;
  selectedOptions: string[];
  timeToAnswer: number;
  isCorrect: boolean;
  points: number;
}

interface Option {
  _id: mongoose.Types.ObjectId;
  text: string;
  isCorrect: boolean;
}

interface Question {
  _id: mongoose.Types.ObjectId;
  type: 'MCQ' | 'TRUE_FALSE' | 'MULTIPLE_CORRECT';
  text: string;
  options: Option[];
  timeLimit: number;
  order: number;
}

console.log("Hello");


export const initSocket = (server: NetServer) => {
  const io = new SocketIOServer(server);

  console.log("I am created");
  
  io.on('connection', (socket) => {
    let currentRoom: string;

    console.log("I am connected");
    

    socket.on('join-quiz', async ({ joinCode, participantName }: { joinCode: string; participantName: string }) => {
      try {
        const quiz = await Quiz.findOne({ joinCode });
        if (!quiz) {
          socket.emit('error', 'Quiz not found');
          return;
        }

        const session = await QuizSession.findOne({ quiz: quiz._id, status: { $ne: 'completed' } });
        if (!session) {
          socket.emit('error', 'Quiz session not found');
          return;
        }

        const participant: Participant = {
          _id: new mongoose.Types.ObjectId(),
          name: participantName,
          score: 0,
          answers: []
        };

        session.participants.push(participant);
        await session.save();

        currentRoom = `quiz-${joinCode}`;
        socket.join(currentRoom);

        io.to(currentRoom).emit('participant-joined', {
          participants: session.participants,
        });

        socket.emit('joined-successfully', {
          sessionId: session._id,
          participantId: participant._id,
        });
      } catch (error) {
        socket.emit('error', 'Failed to join quiz');
      }
    });

    socket.on('submit-answer', async ({ 
      sessionId, 
      participantId, 
      questionId, 
      answer, 
      timeToAnswer 
    }: {
      sessionId: string;
      participantId: string;
      questionId: string;
      answer: string[];
      timeToAnswer: number;
    }) => {
      try {
        const session = await QuizSession.findById(sessionId);
        if (!session) return;

        const quiz = await Quiz.findById(session.quiz);
        if (!quiz) return;

        const question = quiz.questions[session.currentQuestion];
        const isCorrect = validateAnswer(question, answer);
        const points = calculatePoints(isCorrect, timeToAnswer, question.timeLimit);

        const participant = session.participants.id(participantId);
        if (participant) {
          participant.answers.push({
            questionId,
            selectedOptions: answer,
            timeToAnswer,
            isCorrect,
            points,
          });
          participant.score += points;
          await session.save();
        }

        const leaderboard = getLeaderboard(session.participants);
        io.to(currentRoom).emit('leaderboard-update', leaderboard);
      } catch (error) {
        socket.emit('error', 'Failed to submit answer');
      }
    });

    const validateAnswer = (question: Question, answer: string[]): boolean => {
      if (question.type === 'MCQ') {
        const correctOption = question.options.find((opt: Option) => opt.isCorrect);
        return answer[0] === correctOption?._id.toString();
      } else if (question.type === 'MULTIPLE_CORRECT') {
        const correctOptions = question.options
          .filter((opt: Option) => opt.isCorrect)
          .map((opt: Option) => opt._id.toString());
        return (
          answer.length === correctOptions.length &&
          answer.every((ans: string) => correctOptions.includes(ans))
        );
      }
      return false;
    };

    const calculatePoints = (isCorrect: boolean, timeToAnswer: number, timeLimit: number): number => {
      if (!isCorrect) return 0;
      const timeBonus = Math.max(0, (timeLimit - timeToAnswer) / timeLimit) * 50;
      return Math.round(50 + timeBonus);
    };

    const getLeaderboard = (participants: Participant[]) => {
      return participants
        .map((p: Participant) => ({
          name: p.name,
          score: p.score,
        }))
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
        .slice(0, 5);
    };

    socket.on('disconnect', () => {

      console.log("I am disconnected");
      

      if (currentRoom) {
        socket.leave(currentRoom);
      }
    });
  });

  return io;
};