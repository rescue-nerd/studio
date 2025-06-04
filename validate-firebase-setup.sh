#!/bin/bash
# Firebase Setup Validation Script
# This script validates that all Firebase services are properly configured

echo "🔥 Firebase Setup Validation 🔥"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation functions
validate_firebase_cli() {
    echo "🔍 Checking Firebase CLI..."
    if command -v firebase &> /dev/null; then
        echo -e "${GREEN}✅ Firebase CLI is installed${NC}"
        echo "   Version: $(firebase --version)"
        return 0
    else
        echo -e "${RED}❌ Firebase CLI not found${NC}"
        echo "   Install with: npm install -g firebase-tools"
        return 1
    fi
}

validate_node_version() {
    echo "🔍 Checking Node.js version..."
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | cut -d'v' -f2)
    
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo -e "${GREEN}✅ Node.js version is compatible${NC}"
        echo "   Version: $NODE_VERSION"
        return 0
    else
        echo -e "${RED}❌ Node.js version is too old${NC}"
        echo "   Current: $NODE_VERSION (Required: >= 18.x)"
        return 1
    fi
}

validate_firebase_auth() {
    echo "🔍 Checking Firebase authentication..."
    firebase projects:list > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Firebase authentication valid${NC}"
        return 0
    else
        echo -e "${RED}❌ Firebase authentication failed${NC}"
        echo "   Run: firebase login"
        return 1
    fi
}

validate_firebase_project() {
    echo "🔍 Checking Firebase project..."
    CURRENT_PROJECT=$(firebase use --json 2>/dev/null | jq -r '.active.name' 2>/dev/null)
    if [ "$CURRENT_PROJECT" != "null" ] && [ -n "$CURRENT_PROJECT" ]; then
        echo -e "${GREEN}✅ Firebase project selected${NC}"
        echo "   Project: $CURRENT_PROJECT"
        return 0
    else
        echo -e "${RED}❌ No Firebase project selected${NC}"
        echo "   Run: firebase use <project-id>"
        return 1
    fi
}

validate_env_file() {
    echo "🔍 Checking environment configuration..."
    if [ -f ".env.local" ]; then
        echo -e "${GREEN}✅ .env.local file exists${NC}"
        
        # Check for required environment variables
        REQUIRED_VARS=(
            "NEXT_PUBLIC_FIREBASE_API_KEY"
            "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
            "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
            "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
            "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
            "NEXT_PUBLIC_FIREBASE_APP_ID"
        )
        
        MISSING_VARS=()
        for var in "${REQUIRED_VARS[@]}"; do
            if ! grep -q "^$var=" .env.local; then
                MISSING_VARS+=("$var")
            fi
        done
        
        if [ ${#MISSING_VARS[@]} -eq 0 ]; then
            echo -e "${GREEN}✅ All required environment variables present${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️ Missing environment variables:${NC}"
            for var in "${MISSING_VARS[@]}"; do
                echo "   - $var"
            done
            return 1
        fi
    else
        echo -e "${RED}❌ .env.local file not found${NC}"
        echo "   Copy from .env.example: cp .env.example .env.local"
        return 1
    fi
}

validate_dependencies() {
    echo "🔍 Checking project dependencies..."
    if [ -f "package.json" ] && [ -d "node_modules" ]; then
        echo -e "${GREEN}✅ Project dependencies installed${NC}"
        return 0
    else
        echo -e "${RED}❌ Project dependencies not installed${NC}"
        echo "   Run: npm install"
        return 1
    fi
}

validate_functions_dependencies() {
    echo "🔍 Checking Functions dependencies..."
    if [ -f "functions/package.json" ] && [ -d "functions/node_modules" ]; then
        echo -e "${GREEN}✅ Functions dependencies installed${NC}"
        return 0
    else
        echo -e "${RED}❌ Functions dependencies not installed${NC}"
        echo "   Run: cd functions && npm install"
        return 1
    fi
}

validate_firebase_config() {
    echo "🔍 Checking Firebase configuration..."
    if [ -f "firebase.json" ]; then
        echo -e "${GREEN}✅ firebase.json exists${NC}"
        
        # Check if configuration is valid JSON
        if jq empty firebase.json >/dev/null 2>&1; then
            echo -e "${GREEN}✅ firebase.json is valid JSON${NC}"
            return 0
        else
            echo -e "${RED}❌ firebase.json is invalid JSON${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ firebase.json not found${NC}"
        echo "   Initialize with: firebase init"
        return 1
    fi
}

validate_firestore_rules() {
    echo "🔍 Checking Firestore rules..."
    if [ -f "firestore.rules" ]; then
        echo -e "${GREEN}✅ firestore.rules exists${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️ firestore.rules not found${NC}"
        echo "   This may be expected if Firestore is not used"
        return 0
    fi
}

validate_build() {
    echo "🔍 Testing build process..."
    npm run build > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Application builds successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Build failed${NC}"
        echo "   Check build errors with: npm run build"
        return 1
    fi
}

# Run all validations
echo "Starting Firebase setup validation..."
echo

VALIDATIONS=(
    "validate_node_version"
    "validate_firebase_cli"
    "validate_firebase_auth"
    "validate_firebase_project"
    "validate_env_file"
    "validate_dependencies"
    "validate_functions_dependencies"
    "validate_firebase_config"
    "validate_firestore_rules"
    "validate_build"
)

FAILED_VALIDATIONS=()

for validation in "${VALIDATIONS[@]}"; do
    if ! $validation; then
        FAILED_VALIDATIONS+=("$validation")
    fi
    echo
done

# Summary
echo "================================"
echo "🔥 Validation Summary"
echo "================================"

if [ ${#FAILED_VALIDATIONS[@]} -eq 0 ]; then
    echo -e "${GREEN}🎉 All validations passed!${NC}"
    echo -e "${GREEN}Your Firebase setup is ready for development.${NC}"
    echo
    echo "Next steps:"
    echo "  1. Start development: npm run dev"
    echo "  2. Start emulators: ./firebase-dev.sh start-emulators"
    echo "  3. Deploy: ./deploy.sh"
    exit 0
else
    echo -e "${RED}❌ ${#FAILED_VALIDATIONS[@]} validation(s) failed:${NC}"
    for validation in "${FAILED_VALIDATIONS[@]}"; do
        echo "   - $validation"
    done
    echo
    echo "Please fix the issues above before proceeding."
    exit 1
fi
