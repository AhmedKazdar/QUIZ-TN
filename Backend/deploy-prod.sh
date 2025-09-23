#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting production deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application
echo "🔨 Building the application..."
npm run build

# Copy production environment file
echo "📄 Setting up environment..."
cp .env.production .env

# Start the application using PM2
echo "🚀 Starting the application..."
npm install -g pm2

# Stop existing instance if running
pm2 delete quiz-tn-backend || true

# Start new instance
NODE_ENV=production pm2 start dist/main.js --name "quiz-tn-backend"

# Save PM2 process list
echo "💾 Saving PM2 process list..."
pm2 save

# Set up PM2 to start on system boot
echo "⚙️  Setting up PM2 startup..."
pm2 startup

# Save the PM2 process list again after startup setup
pm2 save

echo "✅ Deployment completed successfully!"
echo "🌐 Your application is now running at https://www.quiztn.com"
