import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB_NAME || "et_finance";

const options = { maxPoolSize: 5 };

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!client) {
    client = new MongoClient(uri, options);
    await client.connect();
  }
  db = client.db(dbName);
  return db;
}

export async function getCollection(name: string) {
  const database = await getDb();
  return database.collection(name);
}
