# 🔧 Quick Google OAuth Setup for eTask

Your Google Sign-In button is now configured but needs a real Google Client ID to work.

## Current Status ✅
- ✅ Environment file created (.env)
- ✅ Server restarted with configuration
- ✅ Google Sign-In button is functional
- ⚠️  Using test Client ID (needs real one)

## Get Your Real Google Client ID

### Step 1: Go to Google Cloud Console
🔗 https://console.cloud.google.com/

### Step 2: Create/Select Project
1. Create a new project or select existing one
2. Enable "Google Identity Services" API

### Step 3: Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. **Authorized JavaScript origins:**
   ```
   http://localhost:3002
   ```
5. **Authorized redirect URIs:**
   ```
   http://localhost:3002
   ```
6. Click **Create** and copy the **Client ID**

### Step 4: Update Your .env File
1. Open `.env` file in your project
2. Replace the test Client ID:
   ```bash
   GOOGLE_CLIENT_ID=your_real_client_id_here.apps.googleusercontent.com
   ```
3. Save the file

### Step 5: Restart Server
```bash
# Stop server (Ctrl+C in terminal)
# Then restart:
npm start
```

## Test Google Sign-In
1. Go to http://localhost:3002/login.html
2. Click the **Google** button
3. Should open Google sign-in popup
4. Complete authentication
5. Should redirect to dashboard

## Current Configuration
- **Server**: http://localhost:3002
- **Login Page**: http://localhost:3002/login.html
- **Config API**: http://localhost:3002/api/config
- **Environment**: Development

## Troubleshooting
- **Error "Google Sign-In not configured"**: Client ID is empty or invalid
- **Error "Google Sign-In is loading"**: Wait a moment for Google's JS to load
- **OAuth errors**: Check authorized origins in Google Console

## Need Help?
The setup script can help you:
```bash
./setup-google-oauth.sh
```
