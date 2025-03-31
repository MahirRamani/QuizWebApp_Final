import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      // Await the params object
      const params = await context.params;
      const id = params.id;
      
      const client = await clientPromise;
      const db = client.db("quizApp");
      
      // Validate the ID
      if (!ObjectId.isValid(id)) {
        return NextResponse.json(
          { error: 'Invalid quiz ID' },
          { status: 400 }
        );
      }
      
      const result = await db.collection("quizzes").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            isActive: true,
          }
        }
      );
      
      if (result.matchedCount === 0) {
        return NextResponse.json(
          { error: 'Quiz not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ message: 'Quiz updated successfully' });
    } catch (error) {
      console.error("Error updating quiz:", error);
      return NextResponse.json(
        { error: 'Failed to update quiz' },
        { status: 500 }
      );
    }
  }