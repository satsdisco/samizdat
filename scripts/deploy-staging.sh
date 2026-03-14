#!/bin/bash
# Deploy to staging environment
set -e

echo "🚀 DEPLOYING TO STAGING"
echo "======================="

# Ensure we're on staging branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "staging" ]; then
    echo "❌ Must be on staging branch. Currently on: $current_branch"
    echo "Run: git checkout staging"
    exit 1
fi

# Build and deploy
echo "📦 Building..."
npm run build

echo "🚀 Deploying to Vercel staging..."
vercel --config vercel-staging.json

echo "✅ Staging deployment complete!"
echo "🔗 Test at: https://samizdat-staging.vercel.app"