// app/api/quiz-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const { quizId, studentName, eventType, timestamp } = await request.json();

    const logEntry = {
      quizId,
      studentName,
      eventType,
      timestamp: new Date(timestamp),
      createdAt: new Date()
    };

    await db.collection('quiz_logs').insertOne(logEntry);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log quiz event:', error);
    return NextResponse.json(
      { error: 'Failed to log quiz event' },
      { status: 500 }
    );
  }
}