"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const dotenv_1 = require("dotenv");
const user_schema_1 = require("../user/user.schema");
const typegoose_1 = require("@typegoose/typegoose");
(0, dotenv_1.config)();
async function updateEmailIndex() {
    try {
        await (0, mongoose_1.connect)(process.env.MONGODB_URI || 'mongodb://localhost:27017/Quiz');
        console.log('Connected to MongoDB');
        const UserModel = (0, typegoose_1.getModelForClass)(user_schema_1.User);
        await UserModel.collection.dropIndex('email_1');
        console.log('Dropped existing email index');
        await UserModel.collection.createIndex({ email: 1 }, { unique: true, sparse: true });
        console.log('Created new sparse and unique index on email field');
        console.log('Migration completed successfully');
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
    finally {
        await mongoose_1.connection.close();
        process.exit(0);
    }
}
updateEmailIndex();
//# sourceMappingURL=update-email-index.js.map