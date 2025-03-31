import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { generateJoinCode } from '@/utils/generateJoinCode';

export async function POST(request: Request) {
  try {
    const client = await clientPromise;
    const db = client.db("quizApp");
    const { title, description, questions, createdBy } = await request.json();

    const quiz = {
      title,
      description,
      joinCode: generateJoinCode(),
      questions,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      isActive: false
    };

    const result = await db.collection("quizzes").insertOne(quiz);
    
    return NextResponse.json({ 
      message: 'Quiz created successfully',
      quizId: result.insertedId 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const client = await clientPromise;
    const db = client.db("quizApp");
    const quizzes = await db.collection("quizzes").find({}).toArray();
    
    return NextResponse.json(quizzes);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch quizzes' }, { status: 500 });
  }
}