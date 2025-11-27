#!/bin/bash

# Production API Integration Test Script
# This script starts the production server and runs comprehensive integration tests

echo "🚀 Starting Production API Integration Tests"
echo "==========================================="

# Check if production server is already running
SERVER_PID=""
CLEANUP_NEEDED=false

# Function to cleanup on exit
cleanup() {
    if [ "$CLEANUP_NEEDED" = true ] && [ ! -z "$SERVER_PID" ]; then
        echo "🧹 Cleaning up: Stopping production server (PID: $SERVER_PID)"
        kill $SERVER_PID 2>/dev/null || true
        sleep 2
    fi
    exit $1
}

# Trap cleanup on script exit
trap 'cleanup $?' EXIT

# Check if server is already running
echo "🔍 Checking if production server is already running..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Production server is already running"
else
    echo "🔧 Starting production server..."
    
    # Build the project first
    echo "📦 Building project..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
    
    # Start production server in background
    echo "🚀 Starting production server on port 3000..."
    NODE_ENV=development PORT=3000 node dist/app-production.js &
    SERVER_PID=$!
    CLEANUP_NEEDED=true
    
    echo "⏳ Waiting for server to start..."
    
    # Wait for server to be ready (max 30 seconds)
    for i in {1..15}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            echo "✅ Production server is ready (PID: $SERVER_PID)"
            break
        fi
        echo "🔄 Waiting for server... ($i/15)"
        sleep 2
    done
    
    # Final check
    if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "❌ Production server failed to start"
        exit 1
    fi
fi

# Wait a bit more to ensure full initialization
sleep 3

echo ""
echo "🧪 Running Integration Tests..."
echo "=============================="

# Run the integration tests
npm run test tests/integration/production-api.test.ts -- --reporter=verbose --timeout=30000

TEST_EXIT_CODE=$?

echo ""
echo "📊 Test Results Summary"
echo "======================"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All integration tests passed!"
    echo "🎉 Production API is fully functional"
else
    echo "❌ Some integration tests failed"
    echo "🔍 Check the test output above for details"
fi

echo ""
echo "🏁 Integration test run complete"

# Exit with test result code
exit $TEST_EXIT_CODE