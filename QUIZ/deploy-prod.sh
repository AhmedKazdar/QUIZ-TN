#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting frontend production build..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application
echo "🔨 Building the application..."
npm run build -- --configuration=production

echo "✅ Build completed successfully!"
echo "📁 The production build is in the 'dist/QUIZ' directory"
echo "🚀 You can now deploy the contents of this directory to your web server"

# If you're using Nginx, you can add deployment commands here
# For example:
# echo "🚚 Deploying to Nginx..."
# sudo cp -r dist/QUIZ/* /var/www/quiz-tn/
# sudo systemctl restart nginx

echo "🌐 Your application is now ready at https://www.quiztn.com"
