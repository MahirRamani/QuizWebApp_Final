// src/models/QuizSession.ts
import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  selectedOptions: [String],
  timeToAnswer: { type: Number, required: true },
  isCorrect: { type: Boolean, required: true },
  points: { type: Number, required: true },
});

const participantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  score: { type: Number, default: 0 },
  answers: [answerSchema],
  joinedAt: { type: Date, default: Date.now },
});

const quizSessionSchema = new mongoose.Schema({
  quiz: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Quiz', 
    required: true 
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed'],
    default: 'waiting',
  },
  currentQuestion: { 
    type: Number, 
    default: -1 
  },
  participants: [participantSchema],
  startTime: Date,
  endTime: Date,
}, { timestamps: true });

// Add index for faster querying
quizSessionSchema.index({ quiz: 1, status: 1 });

// Method to get session leaderboard
quizSessionSchema.methods.getLeaderboard = function() {
  return this.participants
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5)
    .map((p: any) => ({
      name: p.name,
      score: p.score,
    }));
};

// Method to add participant
quizSessionSchema.methods.addParticipant = function(name: string) {
  const participant = {
    name,
    score: 0,
    answers: [],
  };
  this.participants.push(participant);
  return participant;
};

// Method to submit answer
quizSessionSchema.methods.submitAnswer = function(
  participantId: string,
  questionId: string,
  selectedOptions: string[],
  timeToAnswer: number,
  isCorrect: boolean,
  points: number
) {
  const participant = this.participants.id(participantId);
  if (!participant) return null;

  participant.answers.push({
    questionId,
    selectedOptions,
    timeToAnswer,
    isCorrect,
    points,
  });
  participant.score += points;
  return participant;
};

export const QuizSession = mongoose.models.QuizSession || mongoose.model('QuizSession', quizSessionSchema);

// Types for TypeScript
export interface IAnswer {
  questionId: string;
  selectedOptions: string[];
  timeToAnswer: number;
  isCorrect: boolean;
  points: number;
}

export interface IParticipant {
  _id: mongoose.Types.ObjectId;
  name: string;
  score: number;
  answers: IAnswer[];
  joinedAt: Date;
}

export interface IQuizSession {
  _id: mongoose.Types.ObjectId;
  quiz: mongoose.Types.ObjectId;
  status: 'waiting' | 'active' | 'completed';
  currentQuestion: number;
  participants: IParticipant[];
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  getLeaderboard: () => { name: string; score: number }[];
  addParticipant: (name: string) => IParticipant;
  submitAnswer: (
    participantId: string,
    questionId: string,
    selectedOptions: string[],
    timeToAnswer: number,
    isCorrect: boolean,
    points: number
  ) => IParticipant | null;
}