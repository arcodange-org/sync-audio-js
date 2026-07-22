#!/bin/bash
# Script to run example tests

echo "SyncAudio Example Tests"
echo "======================"
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx is not available. Please install Node.js."
    exit 1
fi

echo "Running Playwright tests for example/index.html..."
echo ""

# Run the tests
npx playwright test tests/example.spec.js --headed

echo ""
echo "Tests completed!"
