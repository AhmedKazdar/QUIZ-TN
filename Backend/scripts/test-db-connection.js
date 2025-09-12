const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ahmedkazdar:ahmed@cluster0.qyu9hzf.mongodb.net/Quiz?retryWrites=true&w=majority';

async function testConnection() {
  const client = new MongoClient(MONGODB_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  });

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Successfully connected to MongoDB');

    const db = client.db();
    console.log('Database name:', db.databaseName);

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\nCollections:');
    collections.forEach(coll => console.log(`- ${coll.name}`));

    // Check if users collection exists
    const usersCollection = collections.find(c => c.name === 'users');
    if (usersCollection) {
      console.log('\nFound users collection. Listing users:');
      const users = await db.collection('users').find({}).toArray();
      users.forEach(user => {
        console.log(`- ${user.username} (${user._id})`);
        console.log(`  Email: ${user.email || 'N/A'}`);
        console.log(`  Role: ${user.role || 'admin'}`);
        console.log(`  Has password: ${!!user.password}`);
      });
    } else {
      console.log('\nNo users collection found.');
    }
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  } finally {
    await client.close();
    console.log('\nConnection closed');
  }
}

testConnection();
