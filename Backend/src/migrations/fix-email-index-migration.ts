import { connect, connection } from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config();

async function runMigration() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Quiz';
    console.log('Connecting to MongoDB at:', mongoUri);
    
    await connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as any);
    
    console.log('Connected to MongoDB');
    
    // Get the database instance
    const db = connection.db;
    
    // Ensure database connection is established
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    // Drop the existing unique index on email if it exists
    try {
      await db.collection('users').dropIndex('email_1');
      console.log('Dropped existing email index');
    } catch (err: any) {
      console.log('No existing email index to drop or error dropping index:', err.message);
    }
    
    // Create a new sparse and unique index
    await db.collection('users').createIndex(
      { email: 1 },
      { 
        unique: true,
        sparse: true,
        partialFilterExpression: { email: { $type: 'string' } }
      }
    );
    
    console.log('Created new sparse and unique index on email field');
    
    // Verify the index was created
    const indexes = await db.collection('users').indexes();
    console.log('Current indexes:');
    console.log(JSON.stringify(indexes, null, 2));
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.close();
    console.log('Connection closed');
    process.exit(0);
  }
}

runMigration();
