#!/bin/bash

# Google OAuth Setup Script for eTask
echo "🔧 eTask Google OAuth Setup"
echo "============================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📄 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created!"
else
    echo "📄 .env file already exists"
fi

echo ""
echo "🔗 To set up Google OAuth:"
echo "1. Go to https://console.cloud.google.com/"
echo "2. Create/select a project"
echo "3. Enable 'Google Identity Services'"
echo "4. Create OAuth 2.0 Web credentials with:"
echo "   - Authorized JavaScript origins: http://localhost:3002"
echo "   - Authorized redirect URIs: http://localhost:3002"
echo "5. Copy your Client ID"
echo ""

# Ask for Google Client ID
read -p "📋 Enter your Google Client ID (or press Enter to skip): " google_client_id

if [ ! -z "$google_client_id" ]; then
    # Update .env file
    if grep -q "GOOGLE_CLIENT_ID=" .env; then
        # Replace existing line
        sed -i.bak "s/GOOGLE_CLIENT_ID=.*/GOOGLE_CLIENT_ID=$google_client_id/" .env
    else
        # Add new line
        echo "GOOGLE_CLIENT_ID=$google_client_id" >> .env
    fi
    echo "✅ Google Client ID saved to .env file!"
else
    echo "⏭️  Skipped Google Client ID setup"
fi

echo ""
echo "🚀 Google OAuth setup complete!"
echo "💡 You can manually edit the .env file to update the GOOGLE_CLIENT_ID later"
echo "🔄 Restart your server for changes to take effect"
echo ""

# Check if server is running and offer to restart
if pgrep -f "node server.js" > /dev/null; then
    echo "⚠️  Server is currently running"
    read -p "🔄 Would you like to restart the server now? (y/n): " restart_server
    
    if [ "$restart_server" = "y" ] || [ "$restart_server" = "Y" ]; then
        echo "🛑 Stopping server..."
        pkill -f "node server.js"
        sleep 2
        echo "🚀 Starting server..."
        npm start &
        echo "✅ Server restarted!"
    fi
fi
