import { MongoMemoryServer } from 'mongodb-memory-server-core';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer | null = null;

beforeAll(async (): Promise<void> => {
  console.log('🚀 Starting in-memory MongoDB...');
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);
});

afterAll(async (): Promise<void> => {
  console.log('🧹 Stopping in-memory MongoDB...');
  if (mongod) {
    await mongoose.disconnect();
    await mongod.stop();
    mongod = null;
  }
});
