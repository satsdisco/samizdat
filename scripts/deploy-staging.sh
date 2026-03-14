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
# Copy staging config temporarily
cp vercel-staging.json vercel.json.backup 2>/dev/null || true
cp vercel-staging.json vercel.json
vercel
# Restore original config
mv vercel.json.backup vercel.json 2>/dev/null || true

echo "✅ Staging deployment complete!"
echo "🔗 Test at: https://samizdat-staging.vercel.app"