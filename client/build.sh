#!/bin/bash

# Build the frontend
echo "🏗️  Building frontend..."
npm run build

# Ensure critical Netlify files are copied
echo "📋 Copying Netlify configuration files..."
cp public/_redirects dist/
cp public/404.html dist/

echo "✅ Build complete! Critical files copied:"
echo "   - _redirects (Netlify routing)"
echo "   - 404.html (fallback page)"
echo "   - All assets and HTML files"
echo ""
echo "🚀 Ready for Netlify deployment!" 