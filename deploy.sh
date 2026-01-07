#!/bin/bash
set -e

echo "⚠️  Starting Deployment..."

# 1. Navigate to project dir
cd /home/ubuntu/obhl-hockey-league-2.0

# 2. Reset local changes (wipes the 'sed' patches from previous deploy)
echo "🧹 Resetting local changes..."
git reset --hard HEAD

# 3. Pull latest code
echo "⬇️  Pulling latest code from origin/main..."
git pull origin main

# 4. Patch Frontend URLs (Fix CORS/Localhost)
echo "🔧 Patching Frontend URLs for Production..."
cd frontend/src

# Replace explicit localhost:8000 with relative paths
find . -type f \( -name '*.js' -o -name '*.jsx' \) -exec sed -i 's|http://localhost:8000||g' {} +

# Fix API_BASE_URL to use relative path (robust regex)
# Note: This regex handles potential spaces or quotes differently in source
sed -i "s|const API_BASE_URL = .*|const API_BASE_URL = '/api/v1';|g" services/api.js

echo "✅ Frontend patched."

# 5. Rebuild and Restart Containers
echo "🚀 Rebuilding and restarting containers..."
cd /home/ubuntu/obhl-hockey-league-2.0
sudo docker compose up -d --build

# 6. Cleanup
echo "Cleaning up unused images..."
sudo docker image prune -f

echo "🎉 Deployment Complete!"
