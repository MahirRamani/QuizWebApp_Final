// models/User.ts
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ['admin', 'student', 'superadmin'], default: 'student' },
  }, { timestamps: true });
  
  export const User = mongoose.models.User || mongoose.model('User', userSchema);
  
  // models/QuizSession.ts
  const participantSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    score: { type: Number, default: 0 },
    answers: [{
      questionId: String,
      selectedOptions: [String],
      timeToAnswer: Number,
      isCorrect: Boolean,
      points: Number,
    }],
    joinedAt: { type: Date, default: Date.now },
  });
  
  const quizSessionSchema = new mongoose.Schema({
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    status: {
      type: String,
      enum: ['waiting', 'active', 'completed'],
      default: 'waiting',
    },
    currentQuestion: { type: Number, default: -1 },
    participants: [participantSchema],
    startTime: Date,
    endTime: Date,
  }, { timestamps: true });
  
  export const QuizSession = mongoose.models.QuizSession || mongoose.model('QuizSession', quizSessionSchema);