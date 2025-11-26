# Jira Integration Setup Guide

This guide explains how to set up Jira integration with MCP Tools, enabling natural language queries to your Jira workspace.

## 🟢 Jira API - Free Tier

**Good news:**
- ✅ **100% FREE** for Cloud Standard/Premium plans
- ✅ Generous rate limits (no hard daily limits for most operations)
- ✅ Access to all project data, issues, boards, and sprints
- ✅ Works with both Company-Managed and Team-Managed projects

## 🚀 Quick Setup

### Step 1: Get Your Jira Base URL

Your Jira base URL is typically:
```
https://your-company.atlassian.net
```

You can find it by:
1. Log in to your Jira account
2. Look at the browser URL - it's everything before `/jira/...`
3. Example: If you see `https://acme-corp.atlassian.net/jira/projects`, your base URL is `https://acme-corp.atlassian.net`

### Step 2: Create an API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **"Create API token"**
3. Enter a label (e.g., "MCP Tools App")
4. Click **"Create"**
5. **Copy the token** immediately (you won't be able to see it again!)

### Step 3: Configure Environment Variables

Add to your `webapp/.env` file:

```bash
# Jira Configuration
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token-here
```

### Step 4: Restart the Server

```bash
cd webapp
npm run dev:all
```

## 📋 Available MCP Tools

Once configured, you can use these natural language queries:

### 1. **List Projects**
```
"List my Jira projects"
"Show all Jira projects"
"What projects do I have in Jira?"
```

### 2. **Get Issue Details**
```
"Get details for SCRUM-12"
"Show me issue BN-45"
"Details for SUP-123"
```

### 3. **List Boards**
```
"List boards in UNSEEN project"
"Show all boards of my Jira projects"
"What boards are in project SCRUM?"
```

### 4. **List Issues in Board**
```
"List all tasks in board 1"
"Show issues in SCRUM board"
"What tasks are in board 5?"
```

### 5. **List Issues in Project**
```
"List all tasks in UNSEEN project"
"Show issues in project SCRUM"
"What tasks are in BN project?"
```

### 6. **Search with JQL**
```
"jql: project=SCRUM AND status='In Progress'"
"jql: assignee=currentUser() ORDER BY created DESC"
"Search: project=BN AND priority=High"
```

### 7. **Get Issue Status**
```
"What is the status of SCRUM-5?"
"Status for BN-12"
"Check status of SUP-34"
```

### 8. **List Sprints**
```
"List sprints for board 1"
"Show sprints in project UNSEEN"
"What sprints are in board 3?"
```

### 9. **Get Full Issue Details**
```
"Details for all SCRUM"
"Show full details for SCRUM-12"
"Get everything about issue BN-45"
```

## 🔒 Security & Permissions

### What the API Token Can Access

The API token has the **same permissions as your Jira account**:
- ✅ Can read all projects you have access to
- ✅ Can read all issues, boards, and sprints you can see
- ✅ Can search using JQL
- ❌ Cannot access projects you don't have permission to view

### Security Best Practices

1. **Keep your token secret**
   - Never share your API token
   - Never commit it to git
   - Store it only in `.env` (which is gitignored)

2. **Regenerate if compromised**
   - Go to [API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Revoke the old token
   - Create a new one

3. **Use a dedicated token**
   - Create a token specifically for this app
   - Label it clearly (e.g., "MCP Tools App")
   - Makes it easy to revoke if needed

## 📊 Rate Limits

Jira Cloud has generous rate limits:
- **~300 requests per minute** per user
- **~2000 requests per hour** per IP address
- **No daily limits** for standard operations

The app automatically:
- ✅ Tracks request counts
- ✅ Warns at 80% of limits
- ✅ Prevents hitting rate limits

## 🐛 Troubleshooting

### "Jira is not configured" error

**Solution:**
1. Check that all three environment variables are set in `.env`:
   ```bash
   JIRA_BASE_URL=https://...
   JIRA_EMAIL=...
   JIRA_API_TOKEN=...
   ```
2. Restart the server: `npm run dev:all`

### "HTTP 401 Unauthorized" error

**Causes:**
- ❌ Wrong email address
- ❌ Wrong API token
- ❌ Token has been revoked

**Solution:**
1. Verify your email matches your Jira account
2. Generate a new API token
3. Update `.env` with the new token
4. Restart the server

### "HTTP 403 Forbidden" error

**Cause:** You don't have permission to access that resource

**Solution:**
- Contact your Jira admin to grant you access
- Check that you're querying projects you have access to

### "HTTP 410 Gone" error

**Cause:** Jira has deprecated some search API endpoints

**Solution:**
- ✅ The app automatically falls back to the board API
- ✅ Works transparently - no action needed
- ✅ If you see this, the fallback is working!

### "No projects found"

**Causes:**
- ❌ Wrong Jira base URL
- ❌ No projects in your workspace
- ❌ No permissions to view projects

**Solution:**
1. Verify your `JIRA_BASE_URL` is correct
2. Log in to Jira in your browser to confirm you can see projects
3. Check with your admin about project permissions

### "Board not found" or "Issue not found"

**Causes:**
- ❌ Board/Issue doesn't exist
- ❌ You don't have permission
- ❌ Typo in the key

**Solution:**
1. Verify the board ID or issue key
2. Check permissions in Jira
3. Make sure the project key is correct (e.g., "SCRUM" not "SCRUM-")

## 🆚 JQL vs Natural Language

### When to Use JQL

Use JQL (Jira Query Language) for:
- ✅ Complex queries with multiple conditions
- ✅ Advanced filtering
- ✅ Precise control

**Examples:**
```
"jql: project=SCRUM AND status='In Progress' AND assignee=currentUser()"
"jql: created >= -7d ORDER BY priority DESC"
"jql: labels=urgent AND sprint IS NOT EMPTY"
```

### When to Use Natural Language

Use natural language for:
- ✅ Quick queries
- ✅ Common operations
- ✅ When you don't know JQL

**Examples:**
```
"List all tasks in SCRUM project"
"Show boards in UNSEEN"
"What's the status of SCRUM-12?"
```

## 📈 Usage Monitoring

The app tracks Jira usage in the right panel:
- Currently Jira usage is **not displayed** in the UI (free service, no quotas)
- Rate limiting is handled internally
- No billing to worry about!

## 🔄 Updating Your Configuration

### Change Jira Account

1. Update `.env` with new credentials:
   ```bash
   JIRA_BASE_URL=https://new-company.atlassian.net
   JIRA_EMAIL=new-email@company.com
   JIRA_API_TOKEN=new-token
   ```
2. Restart: `npm run dev:all`

### Revoke Access

1. Go to [API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Find your token (e.g., "MCP Tools App")
3. Click **"Revoke"**
4. The app will stop working until you create a new token

## 🚀 Advanced Usage

### Custom JQL Queries

You can use any valid JQL:

```
"jql: project=SCRUM AND fixVersion=1.0 AND status!=Done"
"jql: assignee=john.doe AND priority in (High, Highest)"
"jql: sprint='Sprint 5' ORDER BY rank ASC"
```

### Working with Boards

Boards are essential for Agile workflows:

1. **List boards in a project:**
   ```
   "List boards in UNSEEN project"
   ```

2. **Get issues from a board:**
   ```
   "List all tasks in board 1"
   ```

3. **Get sprints from a board:**
   ```
   "List sprints for board 1"
   ```

### Working with Sprints

1. **List sprints:**
   ```
   "List sprints for board 1"
   ```

2. **Get issues in a sprint:**
   ```
   "List issues in sprint 5"
   ```

## 🎯 Best Practices

1. **Use specific project keys** when possible
   - Good: "List tasks in SCRUM project"
   - Bad: "Show me everything"

2. **Learn basic JQL** for complex queries
   - It's powerful and worth learning
   - [JQL Reference](https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jira-query-language-jql/)

3. **Check permissions** if queries fail
   - You can only see what you have access to
   - Contact your admin if needed

4. **Use the fallback mechanism**
   - If search fails, try listing boards first
   - Then query issues from specific boards

## 📚 Resources

- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [JQL Reference](https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jira-query-language-jql/)
- [Jira Agile API](https://developer.atlassian.com/cloud/jira/software/rest/)
- [API Token Management](https://id.atlassian.com/manage-profile/security/api-tokens)

## 🆘 Need Help?

If you're stuck:
1. Check this guide
2. Verify your `.env` configuration
3. Test your token in Jira's browser interface
4. Check the server logs for detailed errors
5. Contact the development team

---

**Happy project managing! 🎯**

