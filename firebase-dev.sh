#!/bin/bash
# Firebase Development Utilities
# This script provides utilities for Firebase development and testing

echo "🔥 Firebase Development Utilities 🔥"
echo "====================================="

show_help() {
    echo "Available commands:"
    echo "  start-emulators    - Start Firebase emulators"
    echo "  stop-emulators     - Stop Firebase emulators"
    echo "  reset-data         - Reset emulator data"
    echo "  export-data        - Export emulator data"
    echo "  import-data        - Import emulator data"
    echo "  test-connection    - Test Firebase connection"
    echo "  logs               - Show Firebase logs"
    echo "  help               - Show this help"
}

start_emulators() {
    echo "🚀 Starting Firebase emulators..."
    
    # Create data directory if it doesn't exist
    if [ ! -d "./firebase-data" ]; then
        mkdir -p ./firebase-data
        echo "📁 Created firebase-data directory"
    fi
    
    # Start emulators with data persistence
    firebase emulators:start --import=./firebase-data --export-on-exit=./firebase-data
}

stop_emulators() {
    echo "⏹️ Stopping Firebase emulators..."
    firebase emulators:kill
    echo "✅ Emulators stopped"
}

reset_data() {
    echo "🗑️ Resetting emulator data..."
    if [ -d "./firebase-data" ]; then
        rm -rf ./firebase-data
        echo "✅ Emulator data reset"
    else
        echo "ℹ️ No data to reset"
    fi
}

export_data() {
    echo "📤 Exporting emulator data..."
    firebase emulators:export ./firebase-data-backup
    echo "✅ Data exported to ./firebase-data-backup"
}

import_data() {
    if [ ! -d "./firebase-data-backup" ]; then
        echo "❌ No backup data found at ./firebase-data-backup"
        return 1
    fi
    
    echo "📥 Importing emulator data..."
    firebase emulators:start --import=./firebase-data-backup --export-on-exit=./firebase-data
}

test_connection() {
    echo "🔗 Testing Firebase connection..."
    
    # Check if Firebase CLI is available
    if ! command -v firebase &> /dev/null; then
        echo "❌ Firebase CLI not found. Please install it first."
        return 1
    fi
    
    # Check current project
    CURRENT_PROJECT=$(firebase use --json 2>/dev/null | jq -r '.active.name' 2>/dev/null)
    if [ "$CURRENT_PROJECT" = "null" ] || [ -z "$CURRENT_PROJECT" ]; then
        echo "❌ No Firebase project selected. Run 'firebase use <project-id>'"
        return 1
    fi
    
    echo "✅ Firebase CLI available"
    echo "✅ Current project: $CURRENT_PROJECT"
    
    # Test project access
    firebase projects:list > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Firebase authentication valid"
    else
        echo "❌ Firebase authentication failed. Run 'firebase login'"
        return 1
    fi
    
    echo "✅ Firebase connection test passed"
}

show_logs() {
    echo "📋 Showing Firebase logs..."
    echo "Press Ctrl+C to stop watching logs"
    firebase functions:log
}

# Main script logic
case "$1" in
    start-emulators)
        start_emulators
        ;;
    stop-emulators)
        stop_emulators
        ;;
    reset-data)
        reset_data
        ;;
    export-data)
        export_data
        ;;
    import-data)
        import_data
        ;;
    test-connection)
        test_connection
        ;;
    logs)
        show_logs
        ;;
    help|*)
        show_help
        ;;
esac
