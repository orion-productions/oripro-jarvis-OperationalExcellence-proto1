# Slack Integration Setup Guide

This guide explains how to set up Slack integration with MCP Tools, enabling natural language queries to your Slack workspace.

## 🟢 Slack API - Free Tier

**Good news:**
- ✅ **100% FREE** for standard workspace API calls
- ✅ Rate limits are reasonable (1-100 requests/minute depending on API method)
- ✅ No credit card required for basic features
- ⚠️ Free workspace limits: 10k message history, 10 integrations

## 🚀 Quick Setup (Bot Token - Recommended)

### Step 1: Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. Enter app name (e.g., "MCP Tools Bot")
4. Select your workspace
5. Click **"Create App"**

### Step 2: Add Bot Permissions

1. In your app settings, go to **"OAuth & Permissions"** (left sidebar)
2. Scroll to **"Scopes"** → **"Bot Token Scopes"**
3. Add the following scopes:

#### Required Scopes:
```
channels:read       - View basic channel info
channels:history    - View messages in public channels
users:read          - View people in workspace
search:read         - Search workspace messages
```

#### Optional Scopes (for enhanced features):
```
groups:read         - View private channels (if invited)
groups:history      - Read private channel messages
im:read             - View direct messages
mpim:read           - View group direct messages
```

### Step 3: Install App to Workspace

1. Scroll up to **"OAuth Tokens for Your Workspace"**
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**
4. **Copy the "Bot User OAuth Token"** (starts with `xoxb-...`)

### Step 4: Configure Environment Variables

Add to your `webapp/.env` file:

```bash
# Slack Bot Token
SLACK_BOT_TOKEN=xoxb-your-token-here

# Optional: Slack rate limit overrides
SLACK_DAILY_QUOTA=10000           # 10k requests/day (default)
SLACK_WARNING_THRESHOLD=0.8       # Warn at 80%
SLACK_HARD_LIMIT=0.95             # Block at 95%
```

### Step 5: Restart the Server

```bash
cd webapp
npm run dev:all
```

## 📋 Available MCP Tools

Once configured, you can use these natural language queries:

### 1. **List Channels**
```
"What are the channel names?"
"List Slack channels"
"Show me all channels"
```

### 2. **Search Messages**
```
"Search for messages containing 'bug fix'"
"Find messages with 'deadline'"
```

### 3. **Latest Message in Channel**
```
"What is the last message in #general?"
"Show latest message in #engineering"
```

### 4. **Count Messages from User**
```
"How many messages did @john send in #general?"
"Count messages from @jane in #marketing"
```

### 5. **Get My Mentions**
```
"What are my unread mentions?"
"Show my mentions"
"List my Slack mentions"
```

## 🔒 Security & Privacy

- ✅ **Token stays LOCAL** in your `.env` file (gitignored)
- ✅ **No passwords needed** - just an app token
- ✅ **You control permissions** - only grant what you need
- ✅ **Revokable** - regenerate/revoke anytime in Slack settings
- ✅ **Read-only by default** - no posting/deleting capabilities

## 📊 Rate Limits & Billing Protection

The app includes automatic rate limit protection:

- **Daily quota tracking**: 10k requests/day (default, configurable)
- **Rate limit tracking**: Per-minute and per-hour limits
- **Warning thresholds**: Alert at 80% usage
- **Hard limits**: Block requests at 95% to prevent hitting Slack rate limits
- **UI indicators**: Real-time usage displayed in the right panel (💬 icon)

### Rate Limit Tiers (Slack API)

Different Slack API methods have different rate limits:

- **Tier 1** (e.g., search): 1 request/minute
- **Tier 2** (e.g., send messages): 20 requests/minute
- **Tier 3** (e.g., read history): 50 requests/minute
- **Tier 4** (e.g., list users): 100 requests/minute

The app tracks these automatically and prevents exceeding limits.

## 🆚 Bot Token vs User Token

### Bot Token (xoxb-...) - **Recommended**
✅ Higher rate limits  
✅ Simpler setup  
✅ Works in public channels  
❌ Cannot access DMs unless explicitly invited  
❌ Cannot post as you

### User Token (xoxp-...)
✅ Can access your DMs  
✅ Can post as you  
❌ Lower rate limits  
❌ More complex OAuth2 flow  
❌ Requires user consent

**For most use cases, Bot Token is sufficient!**

## 🐛 Troubleshooting

### "Slack not configured" error
- ✅ Check that `SLACK_BOT_TOKEN` is set in `webapp/.env`
- ✅ Restart the server after adding the token

### "Channel not found" error
- ✅ Make sure the bot is invited to private channels
- ✅ Public channels are accessible by default

### "Not enough permissions" error
- ✅ Go to your Slack App settings
- ✅ Add the required scopes under **"OAuth & Permissions"**
- ✅ **Reinstall** the app to workspace to apply new scopes

### Rate limit exceeded
- ✅ The app will automatically show a warning
- ✅ Quotas reset daily (at midnight)
- ✅ Increase `SLACK_DAILY_QUOTA` in `.env` if needed

## 📈 Usage Monitoring

View real-time Slack API usage in the UI:

- **Right Panel**: Look for the 💬 indicator next to 📧 and 📅
- **Hover**: See exact numbers (e.g., "Slack: 45/10,000 requests")
- **Color coding**:
  - 🟢 Green: < 50% used
  - 🟡 Yellow: 50-80% used
  - 🟠 Orange: > 80% used

## 🔄 Updating Scopes

If you need to add more scopes later:

1. Go to your Slack App settings
2. **"OAuth & Permissions"** → **"Scopes"**
3. Add new scopes
4. **"Reinstall App"** (button at the top)
5. Approve new permissions
6. Restart your server (no need to update token)

## 🚀 Next Steps

- ✅ Configure your Slack token
- ✅ Restart the server
- ✅ Try asking: **"What are the channel names?"**
- ✅ Monitor usage in the right panel (💬 icon)

---

**Questions?** Check the [Slack API Documentation](https://api.slack.com/docs) for more details.

