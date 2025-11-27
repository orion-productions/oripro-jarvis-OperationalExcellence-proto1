# GitHub API Setup Guide

This guide walks you through setting up GitHub API integration for the Jarvis AI Assistant.

## Overview

The GitHub integration allows you to:
- **List repositories** in your organization/account
- **View repository details** (stars, forks, language, size, etc.)
- **List commits** in any repository
- **View commit details** (files changed, additions, deletions)
- **Search code** across all repositories
- **List pull requests** (open, closed, all)
- **List issues** (open, closed, all)

**Important Notes:**
- ✅ **100% FREE** - No billing charges
- ✅ **Rate Limits:** 5,000 requests/hour for authenticated requests
- ✅ **No credit card required**
- ✅ **Read-only access** (we only read data, never write)

---

## Step 1: Create a Personal Access Token (PAT)

### 1.1 Navigate to GitHub Settings

1. Go to [GitHub.com](https://github.com) and sign in
2. Click your **profile picture** (top-right)
3. Click **"Settings"**
4. Scroll down and click **"Developer settings"** (bottom of left sidebar)
5. Click **"Personal access tokens"**
6. Click **"Tokens (classic)"**

**Direct link:** https://github.com/settings/tokens

### 1.2 Generate New Token

1. Click **"Generate new token"** → **"Generate new token (classic)"**
2. You may be asked to confirm your password or 2FA code

### 1.3 Configure Token

#### **Note (Token Name)**
```
Name: MCP Tools - Jarvis AI
```

#### **Expiration**
Choose one:
- ✅ **No expiration** (Recommended for personal projects)
- ⚠️ **90 days** (More secure, but requires renewal)
- 🔧 **Custom** (Your choice)

#### **Select Scopes**

Check these boxes (required):

**✅ repo** - Full control of private repositories
- Automatically selects:
  - ✅ `repo:status` - Access commit status
  - ✅ `repo_deployment` - Access deployment status
  - ✅ `public_repo` - Access public repositories
  - ✅ `repo:invite` - Access repository invitations
  - ✅ `security_events` - Read and write security events

**✅ read:org** - Read org and team membership, read org projects

**✅ read:user** - Read ALL user profile data

**✅ user:email** (Optional) - Access user email addresses (read-only)

**You DON'T need:**
- ❌ `workflow` - We won't modify GitHub Actions
- ❌ `write:packages` - We won't publish packages
- ❌ `delete:packages` - We won't delete packages
- ❌ `admin:*` - We don't need admin access
- ❌ `notifications` - We won't manage notifications
- ❌ `gist` - We won't manage gists

### 1.4 Generate and Copy Token

1. Scroll to the bottom and click **"Generate token"** (green button)
2. **IMPORTANT:** Copy the token immediately! You'll never see it again
3. The token will look like: `ghp_1234567890abcdefghijklmnopqrstuvwxyz1234`

---

## Step 2: Add Token to Environment Variables

### 2.1 Open `.env` File

Navigate to `webapp/.env` and add the following:

```bash
# GitHub Configuration
GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE
GITHUB_OWNER=orion-productions
```

**Replace:**
- `ghp_YOUR_TOKEN_HERE` → Your actual GitHub token
- `orion-productions` → Your GitHub username or organization name

### 2.2 Restart Backend Server

After updating `.env`, restart the backend server:

```bash
cd webapp
npm run dev:all
```

The server should log:
```
[GitHubAuth] Initialized for organization: orion-productions
[BillingService] FREE SERVICES - Rate limit tracking only (no billing):
  GitHub: 120,000 requests/day
```

---

## Step 3: Verify Setup

### 3.1 Check API Status

Open the app at http://localhost:5173 and look at the top-right corner near the **Refresh** button.

You should see:
```
💰$0.00 | 📧0.0% | 📅0.0% | 💬0.0% | 🐙0.0%
```

The octopus icon (🐙) represents GitHub usage.

### 3.2 Test a Query

Try asking:
- "List my repos"
- "Show my repositories"
- "What repos do I have?"

You should see a list of your repositories!

---

## Step 4: Understanding Rate Limits

GitHub provides **5,000 API requests per hour** for authenticated requests.

Our app tracks usage and will block requests if you approach the limit:
- **Warning at 80%** (4,000 requests/hour)
- **Block at 95%** (4,750 requests/hour)

The daily quota is set conservatively at **120,000 requests/day** (5,000/hour × 24 hours).

### Check Current Usage

You can see real-time usage in the app:
- **Top-right corner:** Shows percentage used (e.g., 🐙2.3%)
- **Hover for details:** Shows exact numbers (e.g., "2,760/120,000 requests")

---

## Available MCP Tools

Once configured, you can use these natural language queries:

### 1. List Repositories
```
"List my repos"
"Show my repositories"
"What repos do I have?"
```

**Response:** List of repos with name, description, language, and stars.

### 2. Repository Details
```
"Details for repo oripro-jarvis-OperationalExcellence-proto1"
"Show me repo oripro-jarvis-OperationalExcellence-proto1"
"Info about repository oripro-jarvis-OperationalExcellence-proto1"
```

**Response:** Full details including stars, forks, language, size, dates, license.

### 3. List Commits
```
"List commits in repo oripro-jarvis-OperationalExcellence-proto1"
"Show commits for oripro-jarvis-OperationalExcellence-proto1"
"Recent commits in oripro-jarvis-OperationalExcellence-proto1"
```

**Response:** Last 10 commits with SHA, message, author, and date.

### 4. Commit Details
```
"Show commit abc1234 in repo oripro-jarvis-OperationalExcellence-proto1"
"Details for commit abc1234"
```

**Response:** Full commit details including files changed, additions, deletions.

### 5. Search Code
```
"Search for 'useState' in my github"
"Find code containing 'React.Component' in my repos"
```

**Response:** Code files matching the search query across all repos.

### 6. Pull Requests
```
"List PRs in repo oripro-jarvis-OperationalExcellence-proto1"
"Show pull requests for oripro-jarvis-OperationalExcellence-proto1"
"Open PRs in oripro-jarvis-OperationalExcellence-proto1"
```

**Response:** List of pull requests with title, author, state, and links.

### 7. Issues
```
"List issues in repo oripro-jarvis-OperationalExcellence-proto1"
"Show issues for oripro-jarvis-OperationalExcellence-proto1"
"Open issues in oripro-jarvis-OperationalExcellence-proto1"
```

**Response:** List of issues with title, author, labels, and links.

---

## Optional: Advanced Configuration

You can customize GitHub rate limits in `.env`:

```bash
# GitHub Rate Limits (optional)
GITHUB_DAILY_QUOTA=120000        # Max requests per day (default: 120,000)
GITHUB_WARNING_THRESHOLD=0.8     # Warning at 80% (default)
GITHUB_HARD_LIMIT=0.95           # Block at 95% (default)
```

---

## Troubleshooting

### Issue: "GitHub not configured"

**Cause:** Missing or invalid `GITHUB_TOKEN` in `.env`

**Solution:**
1. Check that `.env` contains `GITHUB_TOKEN=ghp_...`
2. Verify the token starts with `ghp_` or `github_pat_`
3. Restart the backend server

### Issue: "GitHub usage limit exceeded"

**Cause:** You've hit the rate limit (5,000 requests/hour)

**Solution:**
1. Wait 1 hour for the limit to reset
2. Check usage in the app (🐙 icon)
3. Reduce query frequency

### Issue: "Repository not found"

**Cause:** The repository name doesn't exist or you don't have access

**Solution:**
1. Verify the repository name is correct
2. Check that the repository belongs to your organization/account
3. Ensure the token has `repo` scope

### Issue: Token expired

**Cause:** You set an expiration date when creating the token

**Solution:**
1. Go back to https://github.com/settings/tokens
2. Delete the old token
3. Generate a new token (see Step 1)
4. Update `.env` with the new token
5. Restart the backend server

---

## Security Notes

1. ✅ **Never commit `.env`** - It's already in `.gitignore`
2. ✅ **Never share your token** - It has full access to your repos
3. ✅ **Rotate tokens periodically** - Generate new ones every 90 days
4. ✅ **Revoke compromised tokens** - Go to Settings → Developer settings → Tokens and delete it
5. ✅ **Use minimal scopes** - Only grant what's needed (we only need `repo`, `read:org`, `read:user`)

---

## Rate Limit Details

GitHub enforces rate limits per user:

| **Tier** | **Limit** | **Applies To** |
|----------|-----------|----------------|
| Unauthenticated | 60 requests/hour | Public API access |
| Authenticated (PAT) | 5,000 requests/hour | ✅ Our app |
| GitHub App | 5,000 requests/hour | Apps |
| Enterprise Cloud | 15,000 requests/hour | Enterprise users |

Our app uses **authenticated requests** (5,000/hour) which is more than enough for typical usage.

---

## Uninstalling

To remove GitHub integration:

1. **Remove token from `.env`:**
   ```bash
   # Comment out or delete these lines:
   # GITHUB_TOKEN=ghp_...
   # GITHUB_OWNER=...
   ```

2. **Revoke token on GitHub:**
   - Go to https://github.com/settings/tokens
   - Find "MCP Tools - Jarvis AI"
   - Click **Delete**

3. **Restart backend server:**
   ```bash
   cd webapp
   npm run dev:all
   ```

---

## FAQ

### Q: Is this safe?
**A:** Yes! The token only grants read access. We never write to your repositories.

### Q: Will I be charged?
**A:** No! GitHub API is 100% free for authenticated requests (up to 5,000/hour).

### Q: Can I use this for private repos?
**A:** Yes! The `repo` scope grants access to both public and private repositories.

### Q: What if I hit the rate limit?
**A:** The app will block requests automatically and show a message. Wait 1 hour for the limit to reset.

### Q: Can I use multiple organizations?
**A:** Currently, the app only supports one organization at a time (set via `GITHUB_OWNER` in `.env`). To switch, change the value and restart the server.

### Q: Does this work with GitHub Enterprise?
**A:** Yes! GitHub Enterprise uses the same API. Just update the Octokit configuration to point to your Enterprise URL.

---

## Support

If you encounter issues:
1. Check the browser console (F12) for errors
2. Check the backend server logs
3. Verify your token has the correct scopes
4. Try regenerating the token

For more information, see the [GitHub API documentation](https://docs.github.com/en/rest).

---

**✅ Setup complete! You can now query your GitHub repositories using natural language! 🎉**

