#!/bin/bash

# 🚀 PixelPal Deployment Setup Script
# This script prepares your project for Netlify + Render deployment

set -e

echo "🚀 PixelPal Deployment Setup"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📦 Building backend..."
npm run build

echo "📦 Building frontend..."
cd client
npm run build
cd ..

echo "✅ Build completed!"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. BACKEND (Render):"
echo "   - Push to GitHub: git add . && git commit -m 'Deploy setup' && git push"
echo "   - Go to render.com"
echo "   - Create new Web Service from your GitHub repo"
echo "   - Build: npm install && npm run build"
echo "   - Start: npm start"
echo ""
echo "2. FRONTEND (Netlify):"
echo "   - Go to netlify.com"
echo "   - Drag client/dist folder to deploy"
echo "   - Set environment variables with your Render URL"
echo ""
echo "📁 Frontend build ready in: client/dist/"
echo "📁 Backend build ready in: dist/"
echo ""
echo "🔗 For detailed instructions, see: DEPLOY-QUICK-START.md"