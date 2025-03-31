// models/Quiz.ts
import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
});

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['MCQ', 'TRUE_FALSE', 'MULTIPLE_CORRECT'],
    required: true,
  },
  text: { type: String, required: true },
  options: [optionSchema],
  timeLimit: { type: Number, default: 30 },
  order: { type: Number, required: true },
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  joinCode: { type: String, required: true, unique: true },
  questions: [questionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: false },
  startTime: { type: Date },
  endTime: { type: Date },
}, { timestamps: true });

export const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);