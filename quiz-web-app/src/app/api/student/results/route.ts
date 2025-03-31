// app/api/student/results/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const studentName = searchParams.get('name');

    if (!studentName) {
      return NextResponse.json(
        { error: 'Student name is required' },
        { status: 400 }
      );
    }

    const results = await db.collection('quiz_submissions')
      .find({ studentName })
      .sort({ submittedAt: -1 }) // Most recent first
      .toArray();

    return NextResponse.json(results);
  } catch (error) {
    console.error('Failed to fetch student results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch student results' },
      { status: 500 }
    );
  }
}
