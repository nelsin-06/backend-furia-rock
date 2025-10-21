#!/bin/bash

echo "🚀 Setting up Furia Rock Backend..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start MySQL database
echo "🗄️ Starting MySQL database..."
docker compose up -d db

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Start development server
echo "🔥 Starting development server..."
npm run start:dev
