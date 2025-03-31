// app/api/quizzes/join/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(
  request: NextRequest,
  {params}: { params: Promise<{ code: string }> },
) {
  try {
    const { db } = await connectToDatabase();
    const { code } = await params;
    
    const joinCode = code;
    

    console.log("join code", joinCode);
    const quiz = await db.collection('quizzes').findOne({ joinCode: joinCode });

    if (!quiz) {    
      return NextResponse.json(
        { error: 'Quiz not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(quiz);
  } catch (error) {
    console.error('Failed to fetch quiz:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz' },
      { status: 500 }
    );
  }
}

// // app/api/quizzes/join/[code]/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { connectToDatabase } from '@/lib/mongodb';

// export async function GET(
//   request: NextRequest,
//   context: { params: Promise<{ code: string, name: string }> }
// ) {
//   try {
//       const { db } = await connectToDatabase();
//       const params = await context.params;
      
//       const joinCode =  params.code;

//     console.log("join code", joinCode);
//       const quiz = await db.collection('quizzes').findOne({ joinCode: joinCode });

//     if (!quiz) {
//       return NextResponse.json(
//         { error: 'Quiz not found' },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json(quiz);
//   } catch (error) {
//     console.error('Failed to fetch quiz:', error);
//     return NextResponse.json(
//       { error: 'Failed to fetch quiz' },
//       { status: 500 }
//     );
//   }
// }