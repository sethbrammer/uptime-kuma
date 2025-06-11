#!/bin/bash

set -e

echo "🚀 Deploying Uptime Kuma with API to uptime.brmmr.dev..."

# Configuration
REPO_URL="https://github.com/sethbrammer/uptime-kuma.git"
DEPLOY_PATH="/opt/stack/apps/uptime-kuma"
SERVER="root@brmmr.dev"

# Build and push to GitHub first
echo "📦 Building and pushing to GitHub..."
git add .
git commit -m "Add REST API v2 and CLI tools

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>" || echo "No changes to commit"

git push origin main || echo "Push failed or already up to date"

# Deploy to server
echo "🌐 Deploying to server..."
ssh $SERVER << EOF
    # Create deployment directory
    mkdir -p $DEPLOY_PATH
    cd $DEPLOY_PATH

    # Clone or update repository
    if [ -d ".git" ]; then
        echo "Updating existing repository..."
        git fetch origin
        git reset --hard origin/main
    else
        echo "Cloning repository..."
        git clone $REPO_URL .
    fi

    # Stop existing containers
    echo "Stopping existing containers..."
    docker-compose down || echo "No containers to stop"

    # Build and start
    echo "Building and starting containers..."
    docker-compose up -d --build

    # Show status
    echo "Deployment status:"
    docker-compose ps
    
    # Show logs
    echo "Recent logs:"
    docker-compose logs --tail=20
EOF

echo "✅ Deployment complete!"
echo "🌍 Uptime Kuma is now available at: https://uptime.brmmr.dev"
echo "📚 API Documentation: https://uptime.brmmr.dev/api/v2/"
echo ""
echo "🔑 Default credentials:"
echo "   Username: admin"
echo "   Password: admin (change after first login)"
echo ""
echo "🛠️  CLI Usage:"
echo "   # Configure CLI"
echo "   npx uptime-kuma config -u https://uptime.brmmr.dev -U admin -p admin"
echo ""
echo "   # Add a monitor"
echo "   npx uptime-kuma add 'My Site' 'https://example.com'"
echo ""
echo "   # List monitors"
echo "   npx uptime-kuma list"