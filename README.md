# 🤖 Jarvis - Operational Excellence AI Assistant

> Your own Jarvis, specialized in Game Development, leading you to true Operational Excellence

An intelligent AI assistant with **MCP (Model Context Protocol) Tools** that seamlessly integrates with your development workflow. Query your **Jira projects**, **Slack channels**, **Gmail inbox**, and **Google Calendar** using natural language - all with built-in billing protection.

[![GitHub](https://img.shields.io/badge/GitHub-orion--productions-blue)](https://github.com/orion-productions/oripro-jarvis-OperationalExcellence-proto1)

---

## 🌟 Features

### 🎯 **Multi-Service Integration**

**Jira** - Project Management
- ✅ List projects, boards, sprints, and issues
- ✅ Search with JQL or natural language
- ✅ Get issue details, status, and assignments
- ✅ Automatic fallback when APIs fail
- ✅ Example: *"List all tasks in UNSEEN project"*

**Slack** - Team Communication
- ✅ List channels and search messages
- ✅ Get latest messages and mentions
- ✅ Count messages from specific users
- ✅ Example: *"What are my unread mentions?"*

**Gmail** (Optional) - Email Management
- ✅ Search emails and count from senders
- ✅ List unread and important emails
- ✅ Get latest emails from specific people
- ✅ Example: *"How many emails from john@example.com?"*

**Google Calendar** (Optional) - Schedule Management
- ✅ View today's events
- ✅ Check upcoming events
- ✅ Example: *"What's on my calendar today?"*

### 💰 **Billing Protection**

**Google Services** (Gmail, Calendar)
- 🛡️ Cost tracking and quota monitoring
- 🛡️ Hard limits to prevent unexpected charges
- 🛡️ Blocks requests at 95% of free tier
- 🛡️ Monthly cost limit: $0 by default

**Free Services** (Slack, Jira)
- 🛡️ Rate limit tracking only
- 🛡️ No billing - 100% free
- 🛡️ Prevents hitting API rate limits

### 🎨 **User Interface**

- 💬 Chat interface with streaming responses
- 📊 Real-time usage indicators (💰📧📅💬)
- 🎨 Dark/Light mode support
- 🗂️ Conversation history management
- ⚙️ Configurable AI providers (OpenAI, Gemini, Ollama)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Git**
- API credentials for the services you want to use:
  - Jira API token (required)
  - Slack bot/user token (optional)
  - Google OAuth2 credentials (optional)
  - OpenAI or Gemini API key (required)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/orion-productions/oripro-jarvis-OperationalExcellence-proto1.git
   cd oripro-jarvis-OperationalExcellence-proto1/webapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   # Copy the example and edit with your credentials
   cp .env.example .env
   ```

4. **Configure your `.env` file**
   ```bash
   # AI Provider (Choose one)
   OPENAI_API_KEY=your-openai-key
   # OR
   GEMINI_API_KEY=your-gemini-key

   # Jira (Required for Jira features)
   JIRA_BASE_URL=https://your-company.atlassian.net
   JIRA_EMAIL=your-email@company.com
   JIRA_API_TOKEN=your-jira-token

   # Slack (Optional)
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   # OR
   SLACK_USER_TOKEN=xoxp-your-user-token

   # Google Services (Optional)
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
   ```

5. **Start the application**
   ```bash
   npm run dev:all
   ```

6. **Open your browser**
   - Frontend: http://localhost:5173
   - API Server: http://localhost:3001

---

## 📖 Setup Guides

Detailed setup instructions for each service:

- 📋 **[Jira Setup Guide](webapp/JIRA_SETUP.md)** - Configure Jira API access
- 💬 **[Slack Setup Guide](webapp/SLACK_SETUP.md)** - Configure Slack integration
- 📧 **[Google Setup Guide](webapp/GOOGLE_SETUP.md)** - Configure Gmail & Calendar

---

## 💡 Usage Examples

### Natural Language Queries

**Jira**
```
"List my Jira projects"
"Show all tasks in UNSEEN project"
"Get details for SCRUM-12"
"List boards of my Jira projects"
"Show me all issues in sprint 5"
```

**Slack**
```
"List slack channels"
"What is the last message in #general?"
"Search for messages containing 'deployment'"
"How many messages did @john send in #engineering?"
"What are my unread mentions?"
```

**Gmail** (if configured)
```
"List my unread emails"
"How many emails did I receive from boss@company.com?"
"Show me important emails today"
```

**Google Calendar** (if configured)
```
"What's on my calendar today?"
"Show upcoming events for next week"
```

### Chat Interface

1. **Type your question** in the text box
2. **Hit Enter** or click Send
3. **Watch the AI** process your request through MCP tools
4. **Get instant results** from your integrated services

### MCP Tools Panel

- **View all available tools** in the right panel
- **Toggle tools on/off** by clicking checkboxes
- **Monitor usage** with real-time indicators:
  - 💰 Google API costs
  - 📧 Gmail quota usage
  - 📅 Calendar quota usage
  - 💬 Slack rate limits

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         Frontend (React + Vite)             │
│  • Chat UI with streaming responses         │
│  • Real-time usage indicators               │
│  • Conversation history management          │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│       Express Backend (Node.js)             │
│  • MCP Tool endpoints                       │
│  • Natural language pattern matching        │
│  • Billing protection service               │
│  • Authentication services                  │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼──────┐   ┌────────▼────────┐
│ Free Services│   │ Paid Services   │
│  • Jira      │   │  • Gmail        │
│  • Slack     │   │  • Calendar     │
└──────────────┘   └─────────────────┘
```

### Key Components

**Frontend** (`webapp/src/`)
- `chatStore.ts` - State management with Zustand
- `RightPanel.tsx` - MCP tools list and usage indicators
- `MessageList.tsx` - Chat conversation display
- `Composer.tsx` - Message input with streaming

**Backend** (`webapp/server/`)
- `index.cjs` - Express server with MCP tool endpoints
- `billingService.cjs` - Usage tracking and quota protection
- `googleAuthService.cjs` - OAuth2 for Google services
- `slackAuthService.cjs` - Slack API authentication

---

## ⚙️ Configuration

### Environment Variables

#### **AI Provider** (Required - Choose One)
```bash
OPENAI_API_KEY=sk-...              # OpenAI API key
GEMINI_API_KEY=AIza...             # Google Gemini API key
```

#### **Jira** (Optional)
```bash
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-token
```

#### **Slack** (Optional)
```bash
SLACK_BOT_TOKEN=xoxb-...           # Bot token (recommended)
# OR
SLACK_USER_TOKEN=xoxp-...          # User token
SLACK_DAILY_QUOTA=10000            # Daily request limit
```

#### **Google Services** (Optional)
```bash
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Billing Protection
GMAIL_DAILY_QUOTA=1000000000       # 1 billion units/day (free tier)
CALENDAR_DAILY_QUOTA=1000000       # 1 million queries/day (free tier)
MONTHLY_COST_LIMIT=0.00            # $0 = block all paid operations
```

#### **Rate Limits**
```bash
MAX_REQUESTS_PER_MINUTE=100
MAX_REQUESTS_PER_HOUR=1000
```

---

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test with UI
npm run test:ui
```

### Manual Testing
1. Start the app: `npm run dev:all`
2. Open http://localhost:5173
3. Try the example queries above
4. Monitor usage in the right panel

---

## 🛡️ Security

### API Keys
- ✅ All secrets stored in `.env` (gitignored)
- ✅ Never commit API keys to git
- ✅ Use environment variables for all credentials

### Billing Protection
- ✅ Hard limits prevent unexpected charges
- ✅ Daily quota tracking for all services
- ✅ Automatic blocking at 95% usage
- ✅ Real-time cost monitoring for Google services

### Token Management
- ✅ OAuth2 refresh token handling
- ✅ Secure token storage
- ✅ Automatic token renewal

---

## 📊 MCP Tools Reference

### Jira Tools
| Tool Name | Description | Example |
|-----------|-------------|---------|
| `jira_list_projects` | List all Jira projects | *"List my jira projects"* |
| `jira_get_issue` | Get issue by key | *"Get details for SCRUM-12"* |
| `jira_search` | Search with JQL | *"jql: project=SCRUM"* |
| `jira_boards_for_project` | List boards in project | *"List boards in UNSEEN"* |
| `jira_board_issues` | List issues in board | *"List tasks in board 1"* |
| `jira_sprints` | List sprints | *"Show sprints for board 1"* |

### Slack Tools
| Tool Name | Description | Example |
|-----------|-------------|---------|
| `slack_channels` | List all channels | *"List slack channels"* |
| `slack_search` | Search messages | *"Search for 'bug'"* |
| `slack_latest_message` | Get latest message | *"Last message in #general"* |
| `slack_count_from_user` | Count user messages | *"How many from @john in #dev"* |
| `slack_mentions` | Get your mentions | *"Show my mentions"* |

### Gmail Tools (Optional)
| Tool Name | Description | Example |
|-----------|-------------|---------|
| `gmail_search` | Search emails | *"Search emails from boss"* |
| `gmail_count_from` | Count from sender | *"Emails from john@ex.com"* |
| `gmail_latest_from` | Latest from sender | *"Latest from jane@ex.com"* |
| `gmail_unread` | List unread | *"Show unread emails"* |
| `gmail_important_today` | Important today | *"Important emails today"* |

### Calendar Tools (Optional)
| Tool Name | Description | Example |
|-----------|-------------|---------|
| `calendar_today` | Today's events | *"What's on my calendar?"* |
| `calendar_upcoming` | Upcoming events | *"Events next week"* |

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is private and proprietary to Orion Productions.

---

## 🆘 Support

- 📖 Check the setup guides in `webapp/`
- 🐛 Report issues on GitHub
- 💬 Contact the development team

---

## 🎮 Built for Game Development

This AI assistant is optimized for game development workflows:
- Quick access to Jira sprint planning
- Team communication via Slack integration
- Calendar management for milestones
- Natural language queries for rapid information retrieval

**Built with ❤️ by Orion Productions**
