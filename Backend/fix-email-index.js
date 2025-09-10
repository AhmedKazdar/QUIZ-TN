const { MongoClient } = require('mongodb');

async function fixEmailIndex() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('Quiz');
    const users = db.collection('users');

    // Drop existing email index if it exists
    try {
      await users.dropIndex('email_1');
      console.log('Dropped existing email index');
    } catch (err) {
      console.log('No existing email index to drop');
    }

    // Create new sparse and unique index
    await users.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log('Created new sparse and unique index on email field');

    // Verify the index was created
    const indexes = await users.indexes();
    console.log('Current indexes:');
    console.log(JSON.stringify(indexes, null, 2));

  } finally {
    await client.close();
  }
}

fixEmailIndex().catch(console.error);
