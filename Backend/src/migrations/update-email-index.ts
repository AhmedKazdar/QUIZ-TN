import { connect, connection } from 'mongoose';
import { config } from 'dotenv';
import { User } from '../user/user.schema';
import { getModelForClass } from '@typegoose/typegoose';

// Load environment variables
config();

async function updateEmailIndex() {
  try {
    // Connect to MongoDB
    await connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Quiz');
    
    console.log('Connected to MongoDB');
    
    // Get the model
    const UserModel = getModelForClass(User);
    
    // Drop the existing unique index on email
    await UserModel.collection.dropIndex('email_1');
    console.log('Dropped existing email index');
    
    // Create a new sparse and unique index
    await UserModel.collection.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log('Created new sparse and unique index on email field');
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.close();
    process.exit(0);
  }
}

updateEmailIndex();
