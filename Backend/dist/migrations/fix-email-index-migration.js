"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
async function runMigration() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Quiz';
        console.log('Connecting to MongoDB at:', mongoUri);
        await (0, mongoose_1.connect)(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');
        const db = mongoose_1.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }
        try {
            await db.collection('users').dropIndex('email_1');
            console.log('Dropped existing email index');
        }
        catch (err) {
            console.log('No existing email index to drop or error dropping index:', err.message);
        }
        await db.collection('users').createIndex({ email: 1 }, {
            unique: true,
            sparse: true,
            partialFilterExpression: { email: { $type: 'string' } }
        });
        console.log('Created new sparse and unique index on email field');
        const indexes = await db.collection('users').indexes();
        console.log('Current indexes:');
        console.log(JSON.stringify(indexes, null, 2));
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
    finally {
        await mongoose_1.connection.close();
        console.log('Connection closed');
        process.exit(0);
    }
}
runMigration();
//# sourceMappingURL=fix-email-index-migration.js.map