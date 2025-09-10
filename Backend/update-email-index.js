// MongoDB Shell Script to update the email index
// Run this with: mongo your_database_name update-email-index.js

// Drop the existing unique index on email
try {
  db.users.dropIndex("email_1");
  print("Dropped existing email index");
} catch (e) {
  print("Error dropping index (might not exist):", e);
}

// Create a new sparse and unique index
try {
  db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
  print("Created new sparse and unique index on email field");
} catch (e) {
  print("Error creating new index:", e);
}

// List all indexes to verify
printjson(db.users.getIndexes());
