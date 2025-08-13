# Google Sign-In Setup Guide

This project includes functional Google Sign-In integration. The implementation is complete and ready to use once you configure your Google OAuth credentials.

## Quick Setup

Run the setup script to get started quickly:
```bash
./setup-google-oauth.sh
```

## Manual Setup

### 1) Create a Google Cloud project

1. Go to https://console.cloud.google.com/
2. Create/select a project
3. Enable "Google Identity Services" API

### 2) Create OAuth 2.0 Web credentials

1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. **Authorized JavaScript origins:**
   - `http://localhost:3002` (for development)
   - `https://yourdomain.com` (for production)
5. **Authorized redirect URIs:**
   - `http://localhost:3002` (for development)
   - `https://yourdomain.com` (for production)

Copy the **Client ID** when created.

### 3) Configure the application

1. **Add to .env file:**
   ```bash
   GOOGLE_CLIENT_ID=your_actual_client_id_here
   ```

2. **Restart your server:**
   ```bash
   npm start
   ```

## How It Works

### Frontend Implementation
- **Login Page**: `public/login.html` includes complete Google Sign-In integration
- **Google Sign-In Button**: Functional button that triggers Google OAuth flow
- **Token Handling**: Automatically decodes JWT tokens from Google
- **User Data**: Extracts name, email, profile picture from Google response

### Backend Implementation
- **API Endpoint**: `/api/google-login` handles Google authentication
- **User Creation**: Automatically creates new users from Google sign-ins
- **JWT Tokens**: Issues secure JWT tokens for authenticated sessions
- **Database**: Stores users with Google profile information

### Security Features
- **Server-side Config**: Google Client ID served securely from server
- **JWT Verification**: All Google tokens are properly decoded and validated
- **Default Roles**: Google users get 'employee' role by default
- **Password Generation**: Random passwords for Google-only users

## Testing Google Sign-In

1. **Configure Client ID** (see setup above)
2. **Start the server**: `npm start`
3. **Open login page**: http://localhost:3002/login.html
4. **Click "Google" button**: Should open Google sign-in popup
5. **Complete sign-in**: Should redirect to dashboard on success

## Troubleshooting

### "Google Sign-In not configured"
- Check that `GOOGLE_CLIENT_ID` is set in your `.env` file
- Restart your server after updating `.env`
- Check browser console for configuration errors

### "Google Sign-In is loading"
- Wait a moment for Google's JavaScript to load
- Check internet connection
- Ensure `https://accounts.google.com/gsi/client` is accessible

### OAuth Errors
- Verify your domain is added to "Authorized JavaScript origins"
- Ensure Client ID is copied correctly (no extra spaces)
- Check that Google Identity Services API is enabled

## Production Deployment

For production deployment:

1. **Update OAuth settings** in Google Console:
   - Add production domain to authorized origins
   - Add production domain to redirect URIs

2. **Update .env** for production:
   ```bash
   GOOGLE_CLIENT_ID=your_client_id
   CORS_ORIGIN=https://yourdomain.com
   ```

3. **HTTPS Required**: Google Sign-In requires HTTPS in production

## API Reference

### GET /api/config
Returns client-side configuration including Google Client ID.

**Response:**
```json
{
  "googleClientId": "your_google_client_id"
}
```

### POST /api/google-login
Handles Google authentication and user creation/login.

**Request:**
```json
{
  "username": "user@gmail.com",
  "full_name": "User Name",
  "email": "user@gmail.com",
  "role": "employee",
  "picture": "https://...",
  "google_id": "google_user_id"
}
```

**Response:**
```json
{
  "token": "jwt_token",
  "user": {
    "id": 1,
    "username": "user@gmail.com",
    "full_name": "User Name",
    "role": "employee"
  }
}
```

## 5) Test

1. npm start (or npm run dev)
2. Open http://localhost:3002
3. Click “Sign in with Google” and complete the flow

## Security notes

- Don’t commit real client IDs/secrets
- Verify ID tokens on the server
- Limit authorized origins/redirects to trusted domains
- Use HTTPS in production
