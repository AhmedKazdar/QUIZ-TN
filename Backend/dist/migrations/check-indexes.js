"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const dotenv_1 = require("dotenv");
const user_schema_1 = require("../user/user.schema");
const typegoose_1 = require("@typegoose/typegoose");
(0, dotenv_1.config)();
async function checkIndexes() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Quiz';
        console.log('Connecting to MongoDB at:', mongoUri);
        await (0, mongoose_1.connect)(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');
        const UserModel = (0, typegoose_1.getModelForClass)(user_schema_1.User);
        const indexes = await UserModel.collection.indexes();
        console.log('Current indexes:');
        console.log(JSON.stringify(indexes, null, 2));
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        await mongoose_1.connection.close();
        process.exit(0);
    }
}
checkIndexes();
//# sourceMappingURL=check-indexes.js.map