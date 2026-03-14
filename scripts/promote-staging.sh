#!/bin/bash
# Promote staging to production
set -e

echo "🎯 PROMOTING STAGING TO PRODUCTION"
echo "=================================="

# Confirm promotion
echo "⚠️  This will deploy staging changes to samizdat.press"
echo "Have you tested everything on staging? (y/N)"
read -r confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ Promotion cancelled"
    exit 1
fi

# Ensure we're on staging and it's clean
current_branch=$(git branch --show-current)
if [ "$current_branch" != "staging" ]; then
    echo "❌ Must be on staging branch for promotion"
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Staging branch has uncommitted changes"
    exit 1
fi

# Merge to main
echo "🔄 Merging staging → main..."
git checkout main
git pull origin main
git merge staging

# Deploy to production
echo "🚀 Deploying to production..."
npm run build
vercel --prod

echo "📝 Pushing main branch..."
git push origin main

echo "🧹 Returning to staging..."
git checkout staging

echo "✅ PROMOTION COMPLETE!"
echo "🎉 Live at: https://samizdat.press"
echo "📊 Monitor: check logs and user feedback"