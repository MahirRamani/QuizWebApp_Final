// lib/mongodb.ts
import { MongoClient, MongoClientOptions } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
if (!MONGODB_URI) {
  throw new Error('Please add your Mongodb URI to .env.local');
}

const uri = MONGODB_URI;
// Updated options to use valid MongoClientOptions
const options: MongoClientOptions = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

// Helper function to connect to the database and return the database instance
export async function connectToDatabase() {
  const client = await clientPromise;
  const db = client.db("quizApp"); // Replace with your actual database name
  
  return { client, db };
}
// import { MongoClient } from 'mongodb';
// const MONGODB_URI= 'mongodb://localhost:27017/';
// if (!MONGODB_URI) {
//   throw new Error('Please add your Mongodb URI to .env.local');
// }

// const uri = MONGODB_URI;
// const options = {};

// let client;
// let clientPromise: Promise<MongoClient>;

// if (process.env.NODE_ENV === 'development') {
//   let globalWithMongo = global as typeof globalThis & {
//     _mongoClientPromise?: Promise<MongoClient>;
//   };

//   if (!globalWithMongo._mongoClientPromise) {
//     client = new MongoClient(uri, options);
//     globalWithMongo._mongoClientPromise = client.connect();
//   }
//   clientPromise = globalWithMongo._mongoClientPromise;
// } else {
//   client = new MongoClient(uri, options);
//   clientPromise = client.connect();
// }

// export default clientPromise;