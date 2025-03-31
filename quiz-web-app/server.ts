// server.ts - Fixed implementation
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import mongoose from 'mongoose';
import clientPromise from './src/lib/mongodb';
import { ObjectId } from 'mongodb';

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3001;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// Define interfaces for TypeScript
interface Participant {
    _id: ObjectId;
    name: string;
    score: number;
    answers: Array<{
        questionId: string;
        selectedOptions: string[];
        timeToAnswer: number;
        isCorrect: boolean;
        points: number;
    }>;
    joinedAt: Date;
}

interface QuizSession {
    _id: ObjectId;
    quiz: ObjectId;
    status: 'waiting' | 'active' | 'completed';
    currentQuestion: number;
    participants: Participant[];
    startTime?: Date;
    endTime?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

app.prepare().then(() => {
    const httpServer = createServer(handler);
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
        }
    });
    
    io.on('connection', (socket) => {
        let currentRoom: string;
        
        console.log("Socket connected");
        
        socket.on('join-quiz', async ({ joinCode, participantName }: { joinCode: string; participantName: string }) => {
            try {
                console.log("join-code", joinCode);
                
                const client = await clientPromise;
                const db = client.db("quizApp");
                const quiz = await db.collection("quizzes").findOne({ joinCode: joinCode });

                if (!quiz) {
                    socket.emit('error', 'Quiz not found');
                    return;
                }

                // Find or create an active session for this quiz
                let session = await db.collection("quizSessions").findOne({ 
                    quiz: quiz._id, 
                    status: 'waiting'
                });

                // If no active session exists, create one
                if (!session) {
                    const newSession = {
                        quiz: quiz._id,
                        status: 'waiting' as const,
                        currentQuestion: -1,
                        participants: [],
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    
                    const result = await db.collection("quizSessions").insertOne(newSession);
                    session = {
                        ...newSession,
                        _id: result.insertedId
                    };
                }

                // Add participant to the session
                const participant = {
                    _id: new ObjectId(),
                    name: participantName,
                    score: 0,
                    answers: [],
                    joinedAt: new Date()
                };

                await db.collection("quizSessions").updateOne(
                    { _id: session._id },
                    { 
                        $push: { participants: participant as any },
                        $set: { updatedAt: new Date() }
                    }
                );

                // Get updated participants list
                const updatedSession = await db.collection("quizSessions").findOne({ _id: session._id });
                
                if (!updatedSession) {
                    socket.emit('error', 'Failed to join quiz');
                    return;
                }

                currentRoom = `quiz-${joinCode}`;
                socket.join(currentRoom);

                io.to(currentRoom).emit('participant-joined', {
                    participants: updatedSession.participants,
                });

                socket.emit('joined-successfully', {
                    sessionId: session._id,
                    participantId: participant._id,
                });
            } catch (error) {
                console.error("Error joining quiz:", error);
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
                const client = await clientPromise;
                const db = client.db("quizApp");
                
                // Find the session
                const session = await db.collection("quizSessions").findOne({ 
                    _id: new ObjectId(sessionId)
                });
                
                if (!session) {
                    socket.emit('error', 'Session not found');
                    return;
                }

                // Get the quiz to verify the correct answer
                const quiz = await db.collection("quizzes").findOne({ 
                    _id: session.quiz 
                });
                
                if (!quiz) {
                    socket.emit('error', 'Quiz not found');
                    return;
                }

                // Find the current question
                const question = quiz.questions[session.currentQuestion];
                const isCorrect = validateAnswer(question, answer);
                const points = calculatePoints(isCorrect, timeToAnswer, question.timeLimit);

                // Update the participant's score and answers
                await db.collection("quizSessions").updateOne(
                    { 
                        _id: new ObjectId(sessionId),
                        "participants._id": new ObjectId(participantId)
                    },
                    { 
                        $push: { 
                            "participants.$.answers": {
                                questionId,
                                selectedOptions: answer,
                                timeToAnswer,
                                isCorrect,
                                points
                            } as any
                        },
                        $inc: { "participants.$.score": points },
                        $set: { updatedAt: new Date() }
                    }
                );
                // Get updated session to calculate leaderboard
                const updatedSession = await db.collection("quizSessions").findOne({
                    _id: new ObjectId(sessionId)
                });

                if (!updatedSession) {
                    socket.emit('error', 'Failed to update session');
                    return;
                }

                // Create leaderboard
                const leaderboard = getLeaderboard(updatedSession.participants);
                io.to(currentRoom).emit('leaderboard-update', leaderboard);
            } catch (error) {
                console.error("Error submitting answer:", error);
                socket.emit('error', 'Failed to submit answer');
            }
        });

        socket.on('host-join', async ({ joinCode }: { joinCode: string }) => {
            try {
                const client = await clientPromise;
                const db = client.db("quizApp");
                const quiz = await db.collection("quizzes").findOne({ joinCode: joinCode });

                if (!quiz) {
                    socket.emit('error', 'Quiz not found');
                    return;
                }

                // Find or create a session
                let session = await db.collection("quizSessions").findOne({ 
                    quiz: quiz._id, 
                    status: 'waiting'
                });

                if (!session) {
                    const newSession = {
                        quiz: quiz._id,
                        status: 'waiting' as const,
                        currentQuestion: -1,
                        participants: [],
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    
                    const result = await db.collection("quizSessions").insertOne(newSession);
                    session = {
                        ...newSession,
                        _id: result.insertedId
                    };
                }

                // Save room info
                currentRoom = `quiz-${joinCode}`;
                socket.join(currentRoom);

                // Send quiz data to host
                socket.emit('host-connected', {
                    quiz,
                    sessionId: session._id
                });
            } catch (error) {
                console.error("Error in host-join:", error);
                socket.emit('error', 'Failed to connect host');
            }
        });

        // Fix for the start-quiz event handler in server.ts
// Enhanced start-quiz event handler with better logging
socket.on('start-quiz', async ({ sessionId }: { sessionId: string }) => {
    try {
        console.log("Starting quiz with session ID:", sessionId);
        const client = await clientPromise;
        const db = client.db("quizApp");
        
        // Get the quiz details from the session
        const session = await db.collection("quizSessions").findOne({
            _id: new mongoose.Types.ObjectId(sessionId)
        });
        
        if (!session) {
            console.error("Session not found when starting quiz");
            socket.emit('error', 'Session not found');
            return;
        }
        
        const quiz = await db.collection("quizzes").findOne({ _id: session.quiz });
        
        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
            console.error("Quiz has no questions:", quiz);
            socket.emit('error', 'Quiz has no questions');
            return;
        }
        
        console.log(`Quiz has ${quiz.questions.length} questions`);
        
        // Update session status
        await db.collection("quizSessions").updateOne(
            { _id: new mongoose.Types.ObjectId(sessionId) },
            { 
                $set: { 
                    status: 'active',
                    startTime: new Date(),
                    updatedAt: new Date()
                } 
            }
        );

        // Notify all participants
        io.to(currentRoom).emit('quiz-started');
        
        console.log("Quiz started event emitted to room:", currentRoom);
        
        // Automatically start the first question (index 0) after a short delay
        console.log("Scheduling first question to start in 3 seconds...");
        setTimeout(() => {
            console.log("Now starting first question (index 0)");
            socket.emit('start-question', {
                sessionId,
                questionIndex: 0
            });
        }, 3000); // 3 second delay before first question
        
    } catch (error) {
        console.error("Error starting quiz:", error);
        socket.emit('error', 'Failed to start quiz');
    }
});

        // Fix for the start-question event handler in server.ts
socket.on('start-question', async ({ sessionId, questionIndex }: { sessionId: string; questionIndex: number }) => {
    try {
        console.log("Starting question:", questionIndex, "for session:", sessionId);
        const client = await clientPromise;
        const db = client.db("quizApp");
        
        // Get the session
        const session = await db.collection("quizSessions").findOne({
            _id: new mongoose.Types.ObjectId(sessionId)
        });

        if (!session) {
            socket.emit('error', 'Session not found');
            return;
        }

        // Get the quiz
        const quiz = await db.collection("quizzes").findOne({ _id: session.quiz });
        
        if (!quiz || !quiz.questions[questionIndex]) {
            socket.emit('error', 'Question not found');
            return;
        }

        const question = quiz.questions[questionIndex];

        // Update current question in session
        await db.collection("quizSessions").updateOne(
            { _id: new mongoose.Types.ObjectId(sessionId) },
            { 
                $set: { 
                    currentQuestion: questionIndex,
                    updatedAt: new Date()
                } 
            }
        );

        // Prepare client-safe question (without revealing correct answers)
        const clientQuestion = {
            id: question._id.toString(),
            text: question.text,
            options: question.options.map((opt: any) => ({
                id: opt._id.toString(),
                text: opt.text
            })),
            timeLimit: question.timeLimit,
            type: question.type
        };

        // Notify host
        socket.emit('question-started', {
            questionIndex,
            timeLimit: question.timeLimit
        });

        // IMPORTANT: Emit to the entire room, not just back to the socket
        io.to(currentRoom).emit('new-question', {
            question: clientQuestion,
            timeLimit: question.timeLimit
        });
        
        console.log("New question emitted to room:", currentRoom);

        // Set a timeout to end the question automatically
        setTimeout(async () => {
            try {
                console.log("Question time ended for question", questionIndex);
                
                // Get the updated session with any answers
                const updatedSession = await db.collection("quizSessions").findOne({
                    _id: new mongoose.Types.ObjectId(sessionId)
                });
                
                if (!updatedSession) {
                    console.error("Session not found in timeout");
                    return;
                }
                
                // Calculate leaderboard
                const leaderboard = getLeaderboard(updatedSession.participants);
                
                // Notify everyone about the time ending and show leaderboard
                io.to(currentRoom).emit('question-ended', {
                    questionIndex,
                    correctAnswers: question.options
                        .filter((opt: any) => opt.isCorrect)
                        .map((opt: any) => opt._id.toString())
                });
                
                io.to(currentRoom).emit('leaderboard-update', leaderboard);
                
                console.log("Question ended and leaderboard sent to room:", currentRoom);
            } catch (error) {
                console.error("Error handling question timeout:", error);
                socket.emit('error', 'Error processing question timeout');
            }
        }, question.timeLimit * 1000 + 1000); // Add 1 second buffer
        
    } catch (error) {
        console.error("Error starting question:", error);
        socket.emit('error', 'Failed to start question');
    }
});

        socket.on('end-quiz', async ({ sessionId }: { sessionId: string }) => {
            try {
                const client = await clientPromise;
                const db = client.db("quizApp");
                
                // Update session status
                await db.collection("quizSessions").updateOne(
                    { _id: new ObjectId(sessionId) },
                    { 
                        $set: { 
                            status: 'completed',
                            endTime: new Date(),
                            updatedAt: new Date()
                        } 
                    }
                );

                // Get final leaderboard
                const session = await db.collection("quizSessions").findOne({
                    _id: new ObjectId(sessionId)
                });

                if (!session) {
                    socket.emit('error', 'Session not found');
                    return;
                }

                const leaderboard = getLeaderboard(session.participants);
                
                // Notify all participants
                io.to(currentRoom).emit('quiz-completed', { leaderboard });
            } catch (error) {
                console.error("Error ending quiz:", error);
                socket.emit('error', 'Failed to end quiz');
            }
        });

        socket.on('disconnect', () => {
            console.log("Socket disconnected");
            if (currentRoom) {
                socket.leave(currentRoom);
            }
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});

// Helper functions
const validateAnswer = (question: any, answer: string[]): boolean => {
    if (question.type === 'MCQ') {
        const correctOption = question.options.find((opt: any) => opt.isCorrect);
        return answer[0] === correctOption?._id.toString();
    } else if (question.type === 'TRUE_FALSE') {
        const correctOption = question.options.find((opt: any) => opt.isCorrect);
        return answer[0] === correctOption?._id.toString();
    } else if (question.type === 'MULTIPLE_CORRECT') {
        const correctOptions = question.options
            .filter((opt: any) => opt.isCorrect)
            .map((opt: any) => opt._id.toString());
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
        .map((p) => ({
            _id: p._id,
            name: p.name,
            score: p.score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
};

// // server.ts
// import { createServer } from "node:http";
// import next from "next";
// import { Server } from "socket.io";
// import mongoose from 'mongoose';
// import { QuizSession } from './src/models/QuizSession';
// import clientPromise from './src/lib/mongodb';
// import { Quiz } from "./src/models/Quiz";

// const dev = process.env.NODE_ENV !== "production";
// const hostname = "localhost";
// const port = 3001;

// const app = next({ dev, hostname, port });
// const handler = app.getRequestHandler();

// // Connect to MongoDB
// mongoose.connect('mongodb://localhost:27017/quizApp')
// .then(() => console.log('Connected to MongoDB'))
// .catch(err => console.error('MongoDB connection error:', err));

// app.prepare().then(() => {
//     const httpServer = createServer(handler);
//     const io = new Server(httpServer, {
//         cors: {
//             origin: "*",
//         }
//     });
    
//     io.on('connection', (socket) => {
//         let currentRoom: string;
        
//         console.log("Socket connected");
        
        

//         socket.on('join-quiz', async ({ joinCode, participantName }: { joinCode: string; participantName: string }) => {
//             try {
//                 console.log("join-code", joinCode);
                
//                 // Find the quiz using Mongoose
//                 const quiz = await Quiz.findOne({ joinCode: joinCode });
                
//                 console.log("quiz", quiz);
//                 if (!quiz) {
//                     socket.emit('error', 'Quiz not found');
//                     return;
//                 }
        
//                 // Find or create a session for this quiz
//                 let session = await QuizSession.findOne({ 
//                     quiz: quiz._id, 
//                     status: 'waiting' 
//                 });
        
//                 if (!session) {
//                     session = new QuizSession({
//                         quiz: quiz._id,
//                         status: 'waiting',
//                         currentQuestion: -1,
//                         participants: []
//                     });
//                 }
        
//                 // Add participant using the method from the model
//                 const participant = session.addParticipant(participantName);
//                 await session.save();
        
//                 currentRoom = `quiz-${joinCode}`;
//                 socket.join(currentRoom);
        
//                 io.to(currentRoom).emit('participant-joined', {
//                     participants: session.participants,
//                 });
        
//                 socket.emit('joined-successfully', {
//                     sessionId: session._id,
//                     participantId: participant._id,
//                 });
//             } catch (error) {
//                 console.error("Error joining quiz:", error);
//                 socket.emit('error', 'Failed to join quiz');
//             }
//         });
        
//         // And replace the submit-answer event handler with:
//         socket.on('submit-answer', async ({
//             sessionId,
//             participantId,
//             questionId,
//             answer,
//             timeToAnswer
//         }: {
//             sessionId: string;
//             participantId: string;
//             questionId: string;
//             answer: string[];
//             timeToAnswer: number;
//         }) => {
//             try {
//                 // Find the session using Mongoose
//                 console.log("session-id", sessionId);
//                 const session = await QuizSession.findById(sessionId);
//                 if (!session) {
//                     socket.emit('error', 'Session not found');
//                     return;
//                 }
        
//                 console.log("session", session);
//                 // Get the quiz to verify the correct answer
//                 const quiz = await Quiz.findById(session.quiz);
//                 if (!quiz) {
//                     socket.emit('error', 'Quiz not found');
//                     return;
//                 }
        
//                 // Find the current question
//                 const question = quiz.questions[session.currentQuestion];
//                 const isCorrect = validateAnswer(question, answer);
//                 const points = calculatePoints(isCorrect, timeToAnswer, question.timeLimit);
        
//                 // Use the model method to submit answer
//                 session.submitAnswer(
//                     participantId,
//                     questionId,
//                     answer,
//                     timeToAnswer,
//                     isCorrect,
//                     points
//                 );
                
//                 await session.save();
        
//                 // Get leaderboard using model method
//                 const leaderboard = session.getLeaderboard();
//                 io.to(currentRoom).emit('leaderboard-update', leaderboard);
//             } catch (error) {
//                 console.error("Error submitting answer:", error);
//                 socket.emit('error', 'Failed to submit answer');
//             }
//         });


//         console.log("ooo");


//         socket.on('disconnect', () => {
//             console.log("Socket disconnected");
//             if (currentRoom) {
//                 socket.leave(currentRoom);
//             }
//         });
//     });

//     httpServer
//         .once("error", (err) => {
//             console.error(err);
//             process.exit(1);
//         })
//         .listen(port, () => {
//             console.log(`> Ready on http://${hostname}:${port}`);
//         });
// });

// // Helper functions
// const validateAnswer = (question: any, answer: string[]): boolean => {
//     if (question.type === 'MCQ') {
//         const correctOption = question.options.find((opt: any) => opt.isCorrect);
//         return answer[0] === correctOption?._id.toString();
//     } else if (question.type === 'MULTIPLE_CORRECT') {
//         const correctOptions = question.options
//             .filter((opt: any) => opt.isCorrect)
//             .map((opt: any) => opt._id.toString());
//         return (
//             answer.length === correctOptions.length &&
//             answer.every((ans: string) => correctOptions.includes(ans))
//         );
//     }
//     return false;
// };

// const calculatePoints = (isCorrect: boolean, timeToAnswer: number, timeLimit: number): number => {
//     if (!isCorrect) return 0;
//     const timeBonus = Math.max(0, (timeLimit - timeToAnswer) / timeLimit) * 50;
//     return Math.round(50 + timeBonus);
// };

// const getLeaderboard = (participants: any[]) => {
//     return participants
//         .map((p) => ({
//             name: p.name,
//             score: p.score,
//         }))
//         .sort((a, b) => b.score - a.score)
//         .slice(0, 5);
// };






// // server.ts
// import { createServer } from "node:http";
// import next from "next";
// import { Server } from "socket.io";
// import mongoose from 'mongoose';
// // import { QuizSession } from './src/models/QuizSession';
// import clientPromise from './src/lib/mongodb';

// const dev = process.env.NODE_ENV !== "production";
// const hostname = "localhost";
// const port = 3001;

// const app = next({ dev, hostname, port });
// const handler = app.getRequestHandler();

// // Connect to MongoDB
// mongoose.connect('mongodb://localhost:27017/')
// .then(() => console.log('Connected to MongoDB'))
// .catch(err => console.error('MongoDB connection error:', err));

// app.prepare().then(() => {
//     const httpServer = createServer(handler);
//     const io = new Server(httpServer, {
//         cors: {
//             origin: "*",
//         }
//     });
    
//     io.on('connection', (socket) => {
//         let currentRoom: string;
        
//         console.log("Socket connected");
        
//         socket.on('join-quiz', async ({ joinCode, participantName }: { joinCode: string; participantName: string }) => {
//             try {
//                 console.log("join-code", joinCode);
                
//                 // const quiz = await Quiz.findOne({ joinCode: joinCode });
//                 // console.log("quiz", quiz);
//                 // console.log("join code", joinCode);
//                 const client = await clientPromise;
//                 const db = client.db("quizApp");
//                 // const quizzes = await db.collection("quizzes").find({}).toArray();
//                 // console.log("quizzes", quizzes);
//                 const quiz = await db.collection("quizzes").findOne({ joinCode: joinCode });
//                 // console.log("quiz2", quiz);
//                 // console.log("join code2", joinCode);

//                 if (!quiz) {
//                     socket.emit('error', 'Quiz not found');
//                     return;
//                 }
//                 console.log("lol");


//                 const session = await db.collection("quizzes").findOne({ _id: quiz._id, isActive: true });

//                 console.log("id ,session ", quiz._id, session);
//                 if (!session) {
//                     socket.emit('error', 'Quiz session not found');
//                     return;
//                 }

//                 const participant = {
//                     _id: new mongoose.Types.ObjectId(),
//                     name: participantName,
//                     score: 0,
//                     answers: []
//                 };

//                 session.participants.push(participant);
//                 await session.save();

//                 currentRoom = `quiz-${joinCode}`;
//                 socket.join(currentRoom);

//                 io.to(currentRoom).emit('participant-joined', {
//                     participants: session.participants,
//                 });

//                 socket.emit('joined-successfully', {
//                     sessionId: session._id,
//                     participantId: participant._id,
//                 });
//             } catch (error) {
//                 console.log(error);
                
//                 socket.emit('error', 'Failed to join quiz');
//             }
//         });

//         socket.on('submit-answer', async ({
//             sessionId,
//             participantId,
//             questionId,
//             answer,
//             timeToAnswer
//         }: {
//             sessionId: string;
//             participantId: string;
//             questionId: string;
//             answer: string[];
//             timeToAnswer: number;
//         }) => {
//             // try {
//             //     const client = await clientPromise;
//             //     const db = client.db("quizApp");
//             //     const session = await db.collection("quizzes").findOne({_id: sessionId.});
//             //     if (!session) return;

//             //     const quiz = await db.collection("quizzes").findOne({ _id: session._id });
//             //     if (!quiz) return;

//             //     const question = quiz.questions[session.currentQuestion];
//             //     const isCorrect = validateAnswer(question, answer);
//             //     const points = calculatePoints(isCorrect, timeToAnswer, question.timeLimit);

//             //     const participant = session.participants.id(participantId);
//             //     if (participant) {
//             //         participant.answers.push({
//             //             questionId,
//             //             selectedOptions: answer,
//             //             timeToAnswer,
//             //             isCorrect,
//             //             points,
//             //         });
//             //         participant.score += points;
//             //         await session.save();
//             //     }

//             //     const leaderboard = getLeaderboard(session.participants);
//             //     io.to(currentRoom).emit('leaderboard-update', leaderboard);
//             // } catch (error) {
//             //     socket.emit('error', 'Failed to submit answer');
//             // }
//         });


//         console.log("ooo");


//         socket.on('disconnect', () => {
//             console.log("Socket disconnected");
//             if (currentRoom) {
//                 socket.leave(currentRoom);
//             }
//         });
//     });

//     httpServer
//         .once("error", (err) => {
//             console.error(err);
//             process.exit(1);
//         })
//         .listen(port, () => {
//             console.log(`> Ready on http://${hostname}:${port}`);
//         });
// });

// // Helper functions
// const validateAnswer = (question: any, answer: string[]): boolean => {
//     if (question.type === 'MCQ') {
//         const correctOption = question.options.find((opt: any) => opt.isCorrect);
//         return answer[0] === correctOption?._id.toString();
//     } else if (question.type === 'MULTIPLE_CORRECT') {
//         const correctOptions = question.options
//             .filter((opt: any) => opt.isCorrect)
//             .map((opt: any) => opt._id.toString());
//         return (
//             answer.length === correctOptions.length &&
//             answer.every((ans: string) => correctOptions.includes(ans))
//         );
//     }
//     return false;
// };

// const calculatePoints = (isCorrect: boolean, timeToAnswer: number, timeLimit: number): number => {
//     if (!isCorrect) return 0;
//     const timeBonus = Math.max(0, (timeLimit - timeToAnswer) / timeLimit) * 50;
//     return Math.round(50 + timeBonus);
// };

// const getLeaderboard = (participants: any[]) => {
//     return participants
//         .map((p) => ({
//             name: p.name,
//             score: p.score,
//         }))
//         .sort((a, b) => b.score - a.score)
//         .slice(0, 5);
// };