# Google Sign-In Setup Guide

## Setting Up Google Sign-In for Your Application

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API

### Step 2: Configure OAuth 2.0

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized JavaScript origins:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)
5. Add authorized redirect URIs:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)

### Step 3: Get Your Client ID

Copy the generated Client ID from the Google Cloud Console.

### Step 4: Update Your Application

1. **Update HTML file** (`public/index.html`):
   Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID:
   ```html
   <div id="g_id_onload"
        data-client_id="123456789-abcdef.apps.googleusercontent.com"
        data-callback="handleGoogleSignIn"
        data-auto_prompt="false">
   </div>
   ```

2. **Update JavaScript file** (`public/js/app.js`):
   Replace the placeholder with your Client ID:
   ```javascript
   const GOOGLE_CLIENT_ID = '123456789-abcdef.apps.googleusercontent.com';
   ```

### Step 5: Test the Integration

1. Restart your server: `npm start`
2. Open `http://localhost:3000`
3. Click the "Sign in with Google" button
4. Complete the Google sign-in process

### Security Notes

- Keep your Client ID secure
- Never commit the actual Client ID to public repositories
- Use environment variables in production
- Regularly rotate your OAuth credentials

### Troubleshooting

**Common Issues:**
1. **"Invalid Client ID"** - Check that your Client ID is correct
2. **"Unauthorized Domain"** - Add your domain to authorized origins
3. **"Redirect URI Mismatch"** - Ensure redirect URIs match exactly

**For Development:**
- Use `http://localhost:3000` as both origin and redirect URI
- Make sure your server is running on port 3000

**For Production:**
- Use your actual domain (e.g., `https://yourapp.com`)
- Enable HTTPS for security
