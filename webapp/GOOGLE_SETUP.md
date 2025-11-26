# Google Cloud Setup Guide

This guide explains how to set up Gmail and Google Calendar integration with billing protection.

## 📋 Prerequisites

1. A Google Account
2. Access to [Google Cloud Console](https://console.cloud.google.com)

## 🚀 Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Create Project"** or select an existing project
3. Enter project name (e.g., "MCP Tools App")
4. Click **"Create"**

## 🔑 Step 2: Enable APIs

1. In the Cloud Console, go to **"APIs & Services" → "Library"**
2. Search and enable the following APIs:
   - **Gmail API**
   - **Google Calendar API**
   - (Optional) **Cloud Billing API** - for cost tracking

## 🎫 Step 3: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services" → "Credentials"**
2. Click **"Create Credentials" → "OAuth 2.0 Client ID"**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (or Internal if using Google Workspace)
   - App name: "MCP Tools App"
   - User support email: your-email@gmail.com
   - Developer contact: your-email@gmail.com
   - Scopes: Add `gmail.readonly`, `gmail.modify`, `calendar.readonly`, `calendar`
   - Test users: Add your email address
4. Back to Create Credentials:
   - Application type: **Desktop app**
   - Name: "MCP Tools Desktop Client"
   - Click **"Create"**
5. **Download the JSON** or copy the Client ID and Client Secret

## ⚙️ Step 4: Configure Environment Variables

Create a `.env` file in the `webapp/` directory:

```bash
# Copy these from Google Cloud Console
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Billing Protection (Optional - defaults are safe)
GMAIL_DAILY_QUOTA=1000000000          # 1 billion units/day (FREE)
GMAIL_HARD_LIMIT=0.95                 # Block at 95% usage
CALENDAR_DAILY_QUOTA=1000000          # 1 million queries/day (FREE)
CALENDAR_HARD_LIMIT=0.95              # Block at 95% usage
MONTHLY_COST_LIMIT=0.00               # $0 = block all paid operations
MAX_REQUESTS_PER_MINUTE=100
MAX_REQUESTS_PER_HOUR=1000

# Your existing keys (keep them)
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
JIRA_BASE_URL=your-jira-url
JIRA_EMAIL=your-email
JIRA_API_TOKEN=your-token
```

## 📦 Step 5: Install Dependencies

```bash
cd webapp
npm install
```

This will install the new `googleapis` package.

## ▶️ Step 6: Start the Server

```bash
npm run dev:all
```

## 🔐 Step 7: Authenticate with Google

1. Open the app: http://localhost:5173
2. Look for a "Login with Google" button or notification
3. Click to start OAuth2 flow
4. Authorize the app to access Gmail and Calendar
5. You'll be redirected back to the app

## 🎯 Usage Examples

Once authenticated, you can ask:

### Gmail Queries
- "How many emails did I receive from john@example.com?"
- "When was the latest email I received from support@company.com?"
- "What are the most important emails I received today?"
- "Can you list all unread emails by order of importance?"
- "Search emails about project deadline"

### Calendar Queries
- "What's on my calendar today?"
- "Show me upcoming events for next week"
- "Do I have any meetings today?"

## 🛡️ Billing Protection Features

The app includes multiple safety layers:

### 1. Pre-Request Checks
Every Gmail/Calendar request is checked BEFORE execution:
- Daily quota usage (warn at 80%, block at 95%)
- Monthly costs (block if exceeds limit)
- Rate limiting (per minute/hour)

### 2. Blocked Request Example
```
User: "How many emails from john@example.com?"

AI: ❌ Over usage limit for gmail. Daily quota: 95% used 
(950,000,000/1,000,000,000). Request blocked to avoid 
charges. Quota resets at midnight UTC.
```

### 3. Usage Display
The MCP Tools panel shows real-time usage:
```
┌─────────────────────────────────────────┐
│ MCP Tools  💰 $0.00  📧 0.1%  📅 0.05% │
└─────────────────────────────────────────┘
```

## 📊 Free Tier Limits

Google provides generous free quotas:

| Service | Free Quota | Notes |
|---------|------------|-------|
| Gmail API | 1 billion units/day | ~200M message reads |
| Calendar API | 1 million queries/day | Plenty for personal use |
| API Calls | First 10K free | Then $0.40 per 10K |

**For personal use, you'll likely NEVER exceed free tier!**

## 🔒 Security Notes

1. **Tokens are stored locally** in `server/.google-tokens.json`
   - ⚠️ **In production**: Encrypt this file!
   - ⚠️ **Never commit** this file to Git
   
2. **Add to .gitignore**:
   ```
   .env
   server/.google-tokens.json
   ```

3. **Revoke access anytime**: https://myaccount.google.com/permissions

## 🐛 Troubleshooting

### "OAuth2 client not initialized"
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are in `.env`
- Restart the server after adding environment variables

### "Not authenticated"
- Click "Login with Google" in the app
- Complete the OAuth2 authorization flow

### "Redirect URI mismatch"
- Ensure `http://localhost:3001/auth/google/callback` is added to:
  - Google Cloud Console → Credentials → Your OAuth Client → Authorized redirect URIs

### "Access blocked: This app's request is invalid"
- Make sure you've configured the OAuth consent screen
- Add your email to "Test users" if using External user type

## 📚 Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com)

