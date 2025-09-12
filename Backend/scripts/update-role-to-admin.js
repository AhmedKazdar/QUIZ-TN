const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ahmedkazdar:ahmed@cluster0.qyu9hzf.mongodb.net/Quiz?retryWrites=true&w=majority';

async function updateUserRole() {
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
    
    // Update the role to 'admin' for the test user
    const result = await users.updateOne(
      { username: 'test' },
      { $set: { role: 'admin' } }
    );
    
    if (result.matchedCount === 0) {
      console.log('No user found with username: test');
    } else if (result.modifiedCount > 0) {
      console.log('Successfully updated user role to admin');
      
      // Verify the update
      const updatedUser = await users.findOne({ username: 'test' });
      console.log('Updated user:', {
        username: updatedUser.username,
        role: updatedUser.role,
        email: updatedUser.email
      });
    } else {
      console.log('User role was already set to admin');
    }
    
  } catch (error) {
    console.error('Error updating user role:', error);
  } finally {
    await client.close();
    console.log('\nConnection closed');
  }
}

updateUserRole();
