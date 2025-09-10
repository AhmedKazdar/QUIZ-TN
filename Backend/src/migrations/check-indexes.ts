import { connect, connection } from 'mongoose';
import { config } from 'dotenv';
import { User, UserDocument } from '../user/user.schema';
import { getModelForClass } from '@typegoose/typegoose';

// Load environment variables
config();

async function checkIndexes() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Quiz';
    console.log('Connecting to MongoDB at:', mongoUri);
    
    await connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as any);
    
    console.log('Connected to MongoDB');
    
    // Get the model
    const UserModel = getModelForClass(User);
    
    // List all indexes
    const indexes = await UserModel.collection.indexes();
    console.log('Current indexes:');
    console.log(JSON.stringify(indexes, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.close();
    process.exit(0);
  }
}

checkIndexes();
