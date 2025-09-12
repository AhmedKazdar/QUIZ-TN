const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ahmedkazdar:ahmed@cluster0.qyu9hzf.mongodb.net/Quiz?retryWrites=true&w=majority';

async function updateTestUser() {
  const client = new MongoClient(MONGODB_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  });

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Successfully connected to MongoDB');

    const db = client.db();
    const users = db.collection('users');
    
    // Find the test user
    const testUser = await users.findOne({ username: 'test' });
    if (!testUser) {
      console.log('Test user not found. Creating a new one...');
      const hashedPassword = await bcrypt.hash('test1234', 10);
      const result = await users.insertOne({
        username: 'test',
        email: 'test@gmail.com',
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Created test user with ID:', result.insertedId);
    } else {
      // Update existing user with known password
      console.log('Updating test user password...');
      const hashedPassword = await bcrypt.hash('test1234', 10);
      await users.updateOne(
        { _id: testUser._id },
        { 
          $set: { 
            password: hashedPassword,
            updatedAt: new Date()
          } 
        }
      );
      console.log('Updated test user password to: test1234');
    }
    
    console.log('Test user credentials:');
    console.log('Username: test');
    console.log('Password: test1234');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nConnection closed');
  }
}

updateTestUser();
