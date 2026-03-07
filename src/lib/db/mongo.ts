import { Db, MongoClient } from "mongodb";

const dbName = process.env.MONGODB_DB_NAME ?? "abtirsi";

type GlobalMongo = typeof globalThis & {
  __mongoClientPromise?: Promise<MongoClient>;
};

const globalMongo = globalThis as GlobalMongo;

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  return new MongoClient(uri, {
    maxPoolSize: 20,
  }).connect();
}

function getClientPromise() {
  if (!globalMongo.__mongoClientPromise) {
    globalMongo.__mongoClientPromise = createClientPromise();
  }
  return globalMongo.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

export const clientPromise = getClientPromise;
