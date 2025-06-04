#!/bin/bash
# Firebase Project Setup Utility
# This script helps with Firebase project initialization and status checking

echo "🔥 Firebase Project Setup Utility 🔥"
echo "======================================"

show_help() {
    echo "Available commands:"
    echo "  status         - Show current Firebase project status"
    echo "  init           - Initialize Firebase project"
    echo "  list-projects  - List available Firebase projects"
    echo "  use <project>  - Select a Firebase project"
    echo "  create-env     - Create .env.local from Firebase config"
    echo "  validate       - Run full setup validation"
    echo "  help           - Show this help"
}

show_status() {
    echo "📊 Firebase Project Status"
    echo "=========================="
    
    # Check Firebase CLI
    if command -v firebase &> /dev/null; then
        echo "✅ Firebase CLI: $(firebase --version)"
    else
        echo "❌ Firebase CLI: Not installed"
        return 1
    fi
    
    # Check authentication
    firebase projects:list > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Authentication: Valid"
    else
        echo "❌ Authentication: Invalid (run 'firebase login')"
        return 1
    fi
    
    # Check current project
    CURRENT_PROJECT=$(firebase use --json 2>/dev/null | jq -r '.active.name' 2>/dev/null)
    if [ "$CURRENT_PROJECT" != "null" ] && [ -n "$CURRENT_PROJECT" ]; then
        echo "✅ Current project: $CURRENT_PROJECT"
    else
        echo "❌ Current project: None selected"
        echo "   Available projects:"
        firebase projects:list --json 2>/dev/null | jq -r '.[] | "   - " + .projectId + " (" + .displayName + ")"' 2>/dev/null || echo "   Unable to list projects"
        return 1
    fi
    
    # Check .env.local
    if [ -f ".env.local" ]; then
        echo "✅ Environment: .env.local exists"
    else
        echo "⚠️  Environment: .env.local missing"
    fi
    
    # Check dependencies
    if [ -d "node_modules" ]; then
        echo "✅ Dependencies: Installed"
    else
        echo "❌ Dependencies: Not installed (run 'npm install')"
    fi
    
    echo "✅ Status check complete"
}

init_firebase() {
    echo "🚀 Initializing Firebase project..."
    
    if [ -f "firebase.json" ]; then
        echo "⚠️  firebase.json already exists. Reinitializing..."
    fi
    
    echo "Please select the features you want to set up:"
    firebase init
    
    echo "✅ Firebase initialization complete"
    echo "Next steps:"
    echo "  1. Create .env.local: ./firebase-project.sh create-env"
    echo "  2. Install dependencies: npm install"
    echo "  3. Start development: npm run dev"
}

list_projects() {
    echo "📋 Available Firebase Projects"
    echo "============================="
    
    firebase projects:list
}

use_project() {
    local project_id="$1"
    
    if [ -z "$project_id" ]; then
        echo "❌ Please provide a project ID"
        echo "Usage: ./firebase-project.sh use <project-id>"
        echo "Available projects:"
        firebase projects:list --json 2>/dev/null | jq -r '.[] | "   - " + .projectId + " (" + .displayName + ")"' 2>/dev/null || echo "   Unable to list projects"
        return 1
    fi
    
    echo "🎯 Selecting Firebase project: $project_id"
    firebase use "$project_id"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully selected project: $project_id"
        echo "🔧 Consider updating your .env.local file with the new project configuration"
    else
        echo "❌ Failed to select project: $project_id"
        return 1
    fi
}

create_env() {
    echo "📝 Creating .env.local from Firebase configuration..."
    
    # Check if user is authenticated and has a project selected
    CURRENT_PROJECT=$(firebase use --json 2>/dev/null | jq -r '.active.name' 2>/dev/null)
    if [ "$CURRENT_PROJECT" = "null" ] || [ -z "$CURRENT_PROJECT" ]; then
        echo "❌ No Firebase project selected. Run: firebase use <project-id>"
        return 1
    fi
    
    echo "Using project: $CURRENT_PROJECT"
    
    # Create .env.local template
    cat > .env.local << EOF
# Firebase Configuration for project: $CURRENT_PROJECT
# Generated on: $(date)

# Firebase Core Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$CURRENT_PROJECT.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$CURRENT_PROJECT
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$CURRENT_PROJECT.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id_here

# Firebase Region
NEXT_PUBLIC_FIREBASE_REGION=us-central1

# Firebase Emulators (set to 'true' for local development)
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

    echo "✅ Created .env.local template"
    echo "⚠️  IMPORTANT: Please update the Firebase configuration values in .env.local"
    echo "   You can find these values in the Firebase Console under Project Settings > Web app"
    echo "   URL: https://console.firebase.google.com/project/$CURRENT_PROJECT/settings/general"
}

run_validation() {
    echo "🔍 Running full Firebase setup validation..."
    
    if [ -f "./validate-firebase-setup.sh" ]; then
        ./validate-firebase-setup.sh
    else
        echo "❌ Validation script not found: ./validate-firebase-setup.sh"
        return 1
    fi
}

# Main script logic
case "$1" in
    status)
        show_status
        ;;
    init)
        init_firebase
        ;;
    list-projects)
        list_projects
        ;;
    use)
        use_project "$2"
        ;;
    create-env)
        create_env
        ;;
    validate)
        run_validation
        ;;
    help|*)
        show_help
        ;;
esac
