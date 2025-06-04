#!/bin/bash
# Firebase Deployment Script
# This script handles the deployment of Firebase projects with proper environment checks

echo "🔥 Firebase Deployment Script 🔥"
echo "-------------------------------"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
else
    echo "✅ Firebase CLI found"
fi

# Check if logged in to Firebase
firebase projects:list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Not logged in to Firebase. Please login."
    firebase login
else
    echo "✅ Already logged in to Firebase"
fi

# Check current project
CURRENT_PROJECT=$(firebase use --json | jq -r '.active.name')
echo "📂 Current Firebase project: $CURRENT_PROJECT"

# Build the application
echo "🔨 Building Next.js application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Aborting deployment."
    exit 1
else
    echo "✅ Build successful"
fi

# Build functions
echo "🔨 Building Firebase Functions..."
cd functions && npm run build && cd ..
if [ $? -ne 0 ]; then
    echo "❌ Functions build failed. Aborting deployment."
    exit 1
else
    echo "✅ Functions build successful"
fi

# Deployment options
echo "Please select what you want to do:"
echo "1) Deploy everything (Hosting, Functions, Firestore rules)"
echo "2) Deploy only Hosting"
echo "3) Deploy only Functions"
echo "4) Deploy only Firestore rules and indexes"
echo "5) Start Firebase emulators for local development"
echo "6) Start Firebase emulators with data import/export"

read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        echo "🚀 Deploying everything..."
        firebase deploy
        ;;
    2)
        echo "🚀 Deploying only Hosting..."
        firebase deploy --only hosting
        ;;
    3)
        echo "🚀 Deploying only Functions..."
        firebase deploy --only functions
        ;;
    4)
        echo "🚀 Deploying only Firestore rules and indexes..."
        firebase deploy --only firestore
        ;;
    5)
        echo "🚀 Starting Firebase emulators..."
        firebase emulators:start
        ;;
    6)
        # Check if data directory exists, if not create it
        if [ ! -d "./firebase-data" ]; then
            mkdir -p ./firebase-data
            echo "📁 Created firebase-data directory for emulator data"
        fi
        
        echo "🚀 Starting Firebase emulators with data persistence..."
        firebase emulators:start --import=./firebase-data --export-on-exit=./firebase-data
        ;;
    *)
        echo "❌ Invalid choice. Aborting."
        exit 1
        ;;
esac

echo "✅ Deployment completed!"
