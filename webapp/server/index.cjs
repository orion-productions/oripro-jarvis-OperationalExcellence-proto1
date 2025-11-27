// Minimal local proxy for OpenAI and Gemini with streaming pass-through.
// Reads keys from .env, handles CORS for http://localhost:5173

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { google } = require("googleapis");

dotenv.config();

// Import Google services
const googleAuth = require("./googleAuthService.cjs");
const billingService = require("./billingService.cjs");

const app = express();
app.use(cors({
	origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
	methods: ["GET", "POST", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

app.get("/health", (req, res) => {
	const googleStatus = googleAuth.getStatus();
	res.json({
		ok: true,
		openai: !!OPENAI_API_KEY,
		gemini: !!GEMINI_API_KEY,
		jira: !!(JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN),
		google: googleStatus.authenticated,
		googleAvailable: googleStatus.available
	});
});

// Simple MCP-like tools registry
const MCP_TOOLS = [
	{
		name: "add",
		title: "Add two numbers",
		inputSchema: {
			type: "object",
			properties: {
				a: { type: "number" },
				b: { type: "number" },
			},
			required: ["a", "b"],
		},
	},
	{
		name: "weather",
		title: "Get weather for a location",
		inputSchema: {
			type: "object",
			properties: {
				location: { type: "string" },
			},
			required: ["location"],
		},
	},
	{
		name: "jira_list_projects",
		title: "Jira: List projects",
		inputSchema: { type: "object", properties: {}, required: [] },
	},
	{
		name: "jira_get_issue",
		title: "Jira: Get issue by key",
		inputSchema: {
			type: "object",
			properties: { key: { type: "string" } },
			required: ["key"],
		},
	},
	{
		name: "jira_search",
		title: "Jira: Search issues (JQL)",
		inputSchema: {
			type: "object",
			properties: {
				jql: { type: "string" },
				maxResults: { type: "number" },
			},
			required: ["jql"],
		},
	},
	{
		name: "jira_list_issues",
		title: "Jira: List issues in a project/space",
		inputSchema: {
			type: "object",
			properties: {
				projectKey: { type: "string" },
				jql: { type: "string" },
				maxResults: { type: "number" },
			},
		},
	},
	{
		name: "jira_issue_status",
		title: "Jira: Get issue status",
		inputSchema: {
			type: "object",
			properties: { key: { type: "string" } },
			required: ["key"],
		},
	},
	{
		name: "jira_sprints",
		title: "Jira: List sprints for a board",
		inputSchema: {
			type: "object",
			properties: {
				boardId: { type: "number" },
				state: { type: "string" }, // active, future, closed
				maxResults: { type: "number" },
			},
			required: ["boardId"],
		},
	},
	{
		name: "jira_issue_details",
		title: "Jira: Get issue details (comments, parent, due date, labels, story points, sprint, team)",
		inputSchema: {
			type: "object",
			properties: { key: { type: "string" } },
			required: ["key"],
		},
	},
	{
		name: "jira_boards_for_project",
		title: "Jira: List boards in a project/space",
		inputSchema: {
			type: "object",
			properties: { projectKey: { type: "string" }, maxResults: { type: "number" } },
			required: ["projectKey"],
		},
	},
	{
		name: "jira_issues_in_sprint",
		title: "Jira: List tasks/issues in a sprint",
		inputSchema: {
			type: "object",
			properties: { sprintId: { type: "number" }, maxResults: { type: "number" } },
			required: ["sprintId"],
		},
	},
	{
		name: "jira_board_issues",
		title: "Jira: List all issues in a board",
		inputSchema: {
			type: "object",
			properties: { boardId: { type: "number" }, maxResults: { type: "number" } },
			required: ["boardId"],
		},
	},
	// Gmail Tools
	{
		name: "gmail_search",
		title: "Gmail: Search emails",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string" },
				maxResults: { type: "number" }
			},
			required: ["query"],
		},
	},
	{
		name: "gmail_count_from",
		title: "Gmail: Count emails from sender",
		inputSchema: {
			type: "object",
			properties: { sender: { type: "string" } },
			required: ["sender"],
		},
	},
	{
		name: "gmail_latest_from",
		title: "Gmail: Get latest email from sender",
		inputSchema: {
			type: "object",
			properties: { sender: { type: "string" } },
			required: ["sender"],
		},
	},
	{
		name: "gmail_unread",
		title: "Gmail: List unread emails",
		inputSchema: {
			type: "object",
			properties: { maxResults: { type: "number" } },
		},
	},
	{
		name: "gmail_important_today",
		title: "Gmail: Get important emails today",
		inputSchema: {
			type: "object",
			properties: { maxResults: { type: "number" } },
		},
	},
	// Calendar Tools
	{
		name: "calendar_today",
		title: "Calendar: Today's events",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "calendar_upcoming",
		title: "Calendar: Upcoming events",
		inputSchema: {
			type: "object",
			properties: { days: { type: "number" } },
		},
	},
	// Slack Tools
	{
		name: "slack_search",
		title: "Slack: Search messages",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string" },
				maxResults: { type: "number" }
			},
			required: ["query"],
		},
	},
	{
		name: "slack_channels",
		title: "Slack: List all channels",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "slack_channel_messages",
		title: "Slack: Get messages from channel",
		inputSchema: {
			type: "object",
			properties: {
				channel: { type: "string" },
				limit: { type: "number" }
			},
			required: ["channel"],
		},
	},
	{
		name: "slack_count_from_user",
		title: "Slack: Count messages from user in channel",
		inputSchema: {
			type: "object",
			properties: {
				channel: { type: "string" },
				user: { type: "string" }
			},
			required: ["channel", "user"],
		},
	},
	{
		name: "slack_latest_message",
		title: "Slack: Get latest message in channel",
		inputSchema: {
			type: "object",
			properties: {
				channel: { type: "string" }
			},
			required: ["channel"],
		},
	},
	{
		name: "slack_mentions",
		title: "Slack: Get my mentions",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	// GitHub Tools
	{
		name: "github_list_repos",
		title: "GitHub: List repositories",
		inputSchema: {
			type: "object",
			properties: {
				type: { type: "string" },
				sort: { type: "string" }
			},
		},
	},
	{
		name: "github_repo_details",
		title: "GitHub: Get repository details",
		inputSchema: {
			type: "object",
			properties: {
				repo: { type: "string" }
			},
			required: ["repo"],
		},
	},
	{
		name: "github_commits",
		title: "GitHub: List commits in repository",
		inputSchema: {
			type: "object",
			properties: {
				repo: { type: "string" },
				branch: { type: "string" },
				limit: { type: "number" }
			},
			required: ["repo"],
		},
	},
	{
		name: "github_commit_details",
		title: "GitHub: Get commit details",
		inputSchema: {
			type: "object",
			properties: {
				repo: { type: "string" },
				sha: { type: "string" }
			},
			required: ["repo", "sha"],
		},
	},
	{
		name: "github_search_code",
		title: "GitHub: Search code across repositories",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string" }
			},
			required: ["query"],
		},
	},
	{
		name: "github_pull_requests",
		title: "GitHub: List pull requests",
		inputSchema: {
			type: "object",
			properties: {
				repo: { type: "string" },
				state: { type: "string" }
			},
			required: ["repo"],
		},
	},
	{
		name: "github_issues",
		title: "GitHub: List issues",
		inputSchema: {
			type: "object",
			properties: {
				repo: { type: "string" },
				state: { type: "string" }
			},
			required: ["repo"],
		},
	},
];

app.get("/mcp/tools", (req, res) => {
	res.json({ tools: MCP_TOOLS });
});

// MCP-like tool: add two numbers
app.post("/mcp/tools/add", (req, res) => {
	const a = Number(req.body?.a);
	const b = Number(req.body?.b);
	if (!Number.isFinite(a) || !Number.isFinite(b)) {
		return res.status(400).json({ ok: false, error: "Invalid input. Expect JSON { a: number, b: number }" });
	}
	return res.json({ ok: true, result: a + b });
});

// Jira helpers
function jiraAuthHeader() {
	if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
		return null;
	}
	const token = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
	return `Basic ${token}`;
}

// MCP: Jira list projects
app.get("/mcp/tools/jira/projects", async (req, res) => {
	try {
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		const resp = await fetch(`${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/api/3/project/search`, {
			headers: { "Authorization": auth, "Accept": "application/json" },
		});
		const data = await resp.json();
		if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data?.errorMessages || "Jira error" });
		return res.json({ ok: true, projects: data?.values || [] });
	} catch (e) {
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP: Jira get issue by key
app.post("/mcp/tools/jira/issue", async (req, res) => {
	try {
		const key = String(req.body?.key || "").trim();
		if (!key) return res.status(400).json({ ok: false, error: "key is required" });
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		const url = `${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/api/3/issue/${encodeURIComponent(key)}?expand=renderedFields`;
		const resp = await fetch(url, { headers: { "Authorization": auth, "Accept": "application/json" } });
		const data = await resp.json();
		if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data?.errorMessages || "Jira error" });
		return res.json({ ok: true, issue: data });
	} catch (e) {
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP: Jira search by JQL
app.post("/mcp/tools/jira/search", async (req, res) => {
	try {
		const jql = String(req.body?.jql || "").trim();
		const maxResults = Number(req.body?.maxResults || 25);
		if (!jql) return res.status(400).json({ ok: false, error: "jql is required" });
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		
		// Use v2 API with GET (more stable and widely supported)
		const fields = ["summary","status","assignee","labels","duedate","parent"].join(",");
		const params = new URLSearchParams({
			jql: jql,
			maxResults: String(maxResults),
			fields: fields
		});
		const url = `${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/api/2/search?${params.toString()}`;
		
		const resp = await fetch(url, {
			method: "GET",
			headers: { "Authorization": auth, "Accept": "application/json" },
		});
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok) {
			// Enhanced error reporting
			let errorMsg = "Jira error";
			if (data?.errorMessages && Array.isArray(data.errorMessages)) {
				errorMsg = data.errorMessages.join(", ");
			} else if (data?.errorMessages) {
				errorMsg = String(data.errorMessages);
			} else if (data?.errors) {
				errorMsg = JSON.stringify(data.errors);
			}
			console.error(`[Jira Search Error] Status ${resp.status}: ${errorMsg}`, { jql, maxResults, url });
			return res.status(resp.status).json({ ok: false, error: `${errorMsg} (HTTP ${resp.status})`, errorMessages: data?.errorMessages });
		}
		return res.json({ ok: true, issues: data?.issues || [], total: data?.total || 0 });
	} catch (e) {
		console.error("[Jira Search Exception]", e);
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP: Jira list issues (projectKey or free JQL)
app.post("/mcp/tools/jira/listIssues", async (req, res) => {
	try {
		const projectKey = (req.body?.projectKey || "").trim();
		const jqlInput = (req.body?.jql || "").trim();
		const maxResults = Number(req.body?.maxResults || 25);
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		let jql = jqlInput;
		if (!jql) {
			if (!projectKey) return res.status(400).json({ ok: false, error: "projectKey or jql is required" });
			jql = `project=${projectKey} ORDER BY created DESC`;
		}
		// Use v2 API with GET
		const fields = ["summary","status","assignee","labels","duedate","parent"].join(",");
		const params = new URLSearchParams({
			jql: jql,
			maxResults: String(maxResults),
			fields: fields
		});
		const url = `${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/api/2/search?${params.toString()}`;
		
		const resp = await fetch(url, {
			method: "GET",
			headers: { "Authorization": auth, "Accept": "application/json" },
		});
		const data = await resp.json();
		if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data?.errorMessages || "Jira error" });
		return res.json({ ok: true, issues: data?.issues || [], total: data?.total || 0 });
	} catch (e) {
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP: Jira issue status
app.post("/mcp/tools/jira/issueStatus", async (req, res) => {
	try {
		const key = String(req.body?.key || "").trim();
		if (!key) return res.status(400).json({ ok: false, error: "key is required" });
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		const url = `${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/api/3/issue/${encodeURIComponent(key)}?fields=status`;
		const resp = await fetch(url, { headers: { "Authorization": auth, "Accept": "application/json" } });
		const data = await resp.json();
		if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data?.errorMessages || "Jira error" });
		return res.json({ ok: true, key, status: data?.fields?.status || null });
	} catch (e) {
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP: Jira sprints by board (Agile API)
app.post("/mcp/tools/jira/sprints", async (req, res) => {
	try {
		const boardId = Number(req.body?.boardId);
		const state = (req.body?.state || "").trim(); // active, future, closed
		const maxResults = Number(req.body?.maxResults || 50);
		if (!boardId) return res.status(400).json({ ok: false, error: "boardId is required" });
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		const params = new URLSearchParams();
		if (state) params.set("state", state);
		if (maxResults) params.set("maxResults", String(maxResults));
		const url = `${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/agile/1.0/board/${boardId}/sprint?${params.toString()}`;
		const resp = await fetch(url, { headers: { "Authorization": auth, "Accept": "application/json" } });
		const data = await resp.json();
		if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data?.errorMessages || "Jira error" });
		return res.json({ ok: true, sprints: data?.values || [], total: data?.total || 0 });
	} catch (e) {
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP: Jira issue details (comments, parent, due date, labels, story points, sprint, team candidates)
app.post("/mcp/tools/jira/issueDetails", async (req, res) => {
	try {
		const key = String(req.body?.key || "").trim();
		if (!key) return res.status(400).json({ ok: false, error: "key is required" });
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		const fields = [
			"summary","status","assignee","duedate","labels","components","parent","comment",
			"customfield_10016", // story points (common)
			"customfield_10020", // sprint (common)
		].join(",");
		const url = `${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${encodeURIComponent(fields)}&expand=renderedFields`;
		const resp = await fetch(url, { headers: { "Authorization": auth, "Accept": "application/json" } });
		const data = await resp.json();
		if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data?.errorMessages || "Jira error" });
		const f = data?.fields || {};
		const details = {
			key,
			summary: f.summary || null,
			status: f.status || null,
			assignee: f.assignee || null,
			dueDate: f.duedate || null,
			labels: f.labels || [],
			components: f.components || [],
			parent: f.parent || null,
			comments: f.comment?.comments || [],
			storyPoints: f.customfield_10016 ?? null,
			rawSprintField: f.customfield_10020 ?? null,
			teamCandidates: f.components || [],
		};
		return res.json({ ok: true, details });
	} catch (e) {
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP: Jira boards by project
app.post("/mcp/tools/jira/boardsByProject", async (req, res) => {
	try {
		const projectKey = String(req.body?.projectKey || "").trim();
		const maxResults = Number(req.body?.maxResults || 50);
		if (!projectKey) return res.status(400).json({ ok: false, error: "projectKey is required" });
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		const params = new URLSearchParams({ projectKeyOrId: projectKey, maxResults: String(maxResults) });
		const url = `${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/agile/1.0/board?${params.toString()}`;
		const resp = await fetch(url, { headers: { "Authorization": auth, "Accept": "application/json" } });
		const data = await resp.json();
		if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data?.errorMessages || "Jira error" });
		return res.json({ ok: true, boards: data?.values || [], total: data?.total || 0 });
	} catch (e) {
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP: Jira all issues in a board (including backlog)
app.post("/mcp/tools/jira/boardIssues", async (req, res) => {
	try {
		const boardId = Number(req.body?.boardId);
		const maxResults = Number(req.body?.maxResults || 100);
		if (!boardId) return res.status(400).json({ ok: false, error: "boardId is required" });
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		// Use Agile API to get all board issues
		const params = new URLSearchParams({ maxResults: String(maxResults) });
		const url = `${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/agile/1.0/board/${boardId}/issue?${params.toString()}`;
		const resp = await fetch(url, { headers: { "Authorization": auth, "Accept": "application/json" } });
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok) {
			console.error(`[Jira Board Issues Error] Status ${resp.status}:`, data?.errorMessages || data?.errors);
			return res.status(resp.status).json({ ok: false, error: data?.errorMessages || data?.errors || "Jira error" });
		}
		return res.json({ ok: true, issues: data?.issues || [], total: data?.total || 0 });
	} catch (e) {
		console.error("[Jira Board Issues Exception]", e);
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP: Jira issues by sprint ID
app.post("/mcp/tools/jira/issuesInSprint", async (req, res) => {
	try {
		const sprintId = Number(req.body?.sprintId);
		const maxResults = Number(req.body?.maxResults || 50);
		if (!sprintId) return res.status(400).json({ ok: false, error: "sprintId is required" });
		const auth = jiraAuthHeader();
		if (!auth) return res.status(400).json({ ok: false, error: "Jira is not configured." });
		// Use GET with query parameters
		const jql = `sprint=${sprintId} ORDER BY created DESC`;
		const fields = ["summary","status","assignee","labels","duedate","parent"].join(",");
		const params = new URLSearchParams({
			jql: jql,
			maxResults: String(maxResults),
			fields: fields
		});
		const url = `${JIRA_BASE_URL.replace(/\/+$/, "")}/rest/api/3/search?${params.toString()}`;
		
		const search = await fetch(url, {
			method: "GET",
			headers: { "Authorization": auth, "Accept": "application/json" },
		});
		const data = await search.json();
		if (!search.ok) return res.status(search.status).json({ ok: false, error: data?.errorMessages || "Jira error" });
		return res.json({ ok: true, issues: data?.issues || [], total: data?.total || 0 });
	} catch (e) {
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// MCP-like tool: get weather using Open-Meteo (no API key)
app.post("/mcp/tools/weather", async (req, res) => {
	try {
		const location = String(req.body?.location || "").trim();
		if (!location) return res.status(400).json({ ok: false, error: "location is required" });
		const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`);
		if (!geo.ok) return res.status(502).json({ ok: false, error: `geocoding failed: ${geo.status}` });
		const geoJson = await geo.json();
		const first = Array.isArray(geoJson?.results) ? geoJson.results[0] : undefined;
		if (!first) return res.status(404).json({ ok: false, error: "location not found" });
		const lat = first.latitude;
		const lon = first.longitude;
		const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
		if (!wx.ok) return res.status(502).json({ ok: false, error: `weather failed: ${wx.status}` });
		const wxJson = await wx.json();
		return res.json({
			ok: true,
			location: {
				name: first.name,
				country: first.country,
				latitude: lat,
				longitude: lon,
			},
			current: wxJson.current_weather || null,
		});
	} catch (e) {
		return res.status(500).json({ ok: false, error: (e && e.message) || "unknown error" });
	}
});

// OpenAI: proxy chat completions (stream and non-stream)
app.post("/v1/chat/completions", async (req, res) => {
	try {
		const upstream = "https://api.openai.com/v1/chat/completions";
		const resp = await fetch(upstream, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${OPENAI_API_KEY}`,
			},
			body: JSON.stringify(req.body),
		});
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return res.status(resp.status).send(text || "Upstream error");
		}
		// If streaming, pipe as-is
		const contentType = resp.headers.get("content-type") || "";
		if (contentType.includes("text/event-stream")) {
			res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");
		} else {
			res.setHeader("Content-Type", "application/json");
		}
		const reader = resp.body.getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			res.write(Buffer.from(value));
		}
		res.end();
	} catch (e) {
		res.status(500).send(`Proxy error: ${(e && e.message) || "unknown"}`);
	}
});

// Gemini: streamGenerateContent
app.post("/v1beta/models/:model:streamGenerateContent", async (req, res) => {
	try {
		const model = req.params.model;
		const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`;
		const resp = await fetch(upstream, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(req.body),
		});
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return res.status(resp.status).send(text || "Upstream error");
		}
		res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		const reader = resp.body.getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			res.write(Buffer.from(value));
		}
		res.end();
	} catch (e) {
		res.status(500).send(`Proxy error: ${(e && e.message) || "unknown"}`);
	}
});

// Gemini: generateContent (non-stream) for simple connectivity testing
app.post("/v1beta/models/:model:generateContent", async (req, res) => {
	try {
		const model = req.params.model;
		const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
		const resp = await fetch(upstream, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(req.body),
		});
		const text = await resp.text().catch(() => "");
		return res.status(resp.status).send(text || "");
	} catch (e) {
		res.status(500).send(`Proxy error: ${(e && e.message) || "unknown"}`);
	}
});

// ============================================================================
// GOOGLE OAUTH2 & BILLING ENDPOINTS
// ============================================================================

// OAuth2: Get authentication status
app.get("/auth/google/status", (req, res) => {
	const status = googleAuth.getStatus();
	res.json({ ok: true, ...status });
});

// OAuth2: Start authentication flow
app.get("/auth/google/login", (req, res) => {
	try {
		const authUrl = googleAuth.getAuthUrl();
		res.json({ ok: true, authUrl });
	} catch (error) {
		res.status(500).json({ ok: false, error: error.message });
	}
});

// OAuth2: Handle callback from Google
app.get("/auth/google/callback", async (req, res) => {
	const { code } = req.query;
	
	if (!code) {
		return res.status(400).send("No authorization code provided");
	}
	
	try {
		await googleAuth.getTokens(code);
		// Redirect to frontend with success
		res.redirect("http://localhost:5173/?auth=success");
	} catch (error) {
		console.error("[OAuth] Error getting tokens:", error.message);
		res.redirect("http://localhost:5173/?auth=error");
	}
});

// OAuth2: Logout
app.post("/auth/google/logout", async (req, res) => {
	try {
		await googleAuth.logout();
		res.json({ ok: true, message: "Logged out successfully" });
	} catch (error) {
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Billing: Get current usage and costs
app.get("/mcp/billing/status", (req, res) => {
	const usage = billingService.getCurrentUsage();
	const authStatus = googleAuth.getStatus();
	res.json({
		ok: true,
		usage,
		authenticated: authStatus.authenticated
	});
});

// ============================================================================
// GMAIL MCP TOOLS
// ============================================================================

// Gmail: Search emails
app.post("/mcp/tools/gmail/search", async (req, res) => {
	try {
		// Check authentication
		if (!googleAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Please login to use Gmail features"
			});
		}

		// Check billing/quota limits
		const check = await billingService.checkAndUpdateUsage('gmail', 'search');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				reason: check.reason,
				message: check.message,
				usage: check.usage || check.costs
			});
		}

		// Ensure tokens are valid
		await googleAuth.ensureValidTokens();
		const auth = googleAuth.getClient();

		// Execute Gmail API call
		const gmail = google.gmail({ version: 'v1', auth });
		const query = req.body.query || '';
		const maxResults = req.body.maxResults || 20;

		const response = await gmail.users.messages.list({
			userId: 'me',
			q: query,
			maxResults
		});

		const messages = response.data.messages || [];
		
		// Get details for each message
		const detailedMessages = await Promise.all(
			messages.slice(0, 10).map(async (msg) => {
				const details = await gmail.users.messages.get({
					userId: 'me',
					id: msg.id,
					format: 'metadata',
					metadataHeaders: ['From', 'Subject', 'Date']
				});
				return details.data;
			})
		);

		res.json({
			ok: true,
			messages: detailedMessages,
			total: response.data.resultSizeEstimate || 0,
			warning: check.warning,
			usage: check.usage
		});
	} catch (error) {
		console.error("[Gmail Search]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Gmail: Count emails from sender
app.post("/mcp/tools/gmail/count-from", async (req, res) => {
	try {
		if (!googleAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Please login to use Gmail features"
			});
		}

		const check = await billingService.checkAndUpdateUsage('gmail', 'search');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		await googleAuth.ensureValidTokens();
		const auth = googleAuth.getClient();
		const gmail = google.gmail({ version: 'v1', auth });

		const sender = req.body.sender;
		const response = await gmail.users.messages.list({
			userId: 'me',
			q: `from:${sender}`
		});

		res.json({
			ok: true,
			count: response.data.resultSizeEstimate || 0,
			sender: sender,
			warning: check.warning
		});
	} catch (error) {
		console.error("[Gmail Count]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Gmail: Get latest email from sender
app.post("/mcp/tools/gmail/latest-from", async (req, res) => {
	try {
		if (!googleAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Please login to use Gmail features"
			});
		}

		const check = await billingService.checkAndUpdateUsage('gmail', 'search');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		await googleAuth.ensureValidTokens();
		const auth = googleAuth.getClient();
		const gmail = google.gmail({ version: 'v1', auth });

		const sender = req.body.sender;
		const response = await gmail.users.messages.list({
			userId: 'me',
			q: `from:${sender}`,
			maxResults: 1
		});

		if (!response.data.messages || response.data.messages.length === 0) {
			return res.json({
				ok: true,
				found: false,
				message: `No emails found from ${sender}`
			});
		}

		const msgId = response.data.messages[0].id;
		const details = await gmail.users.messages.get({
			userId: 'me',
			id: msgId,
			format: 'full'
		});

		res.json({
			ok: true,
			found: true,
			message: details.data,
			sender: sender,
			warning: check.warning
		});
	} catch (error) {
		console.error("[Gmail Latest]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Gmail: List unread emails
app.post("/mcp/tools/gmail/unread", async (req, res) => {
	try {
		if (!googleAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Please login to use Gmail features"
			});
		}

		const check = await billingService.checkAndUpdateUsage('gmail', 'list');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		await googleAuth.ensureValidTokens();
		const auth = googleAuth.getClient();
		const gmail = google.gmail({ version: 'v1', auth });

		const maxResults = req.body.maxResults || 20;
		const response = await gmail.users.messages.list({
			userId: 'me',
			q: 'is:unread',
			maxResults
		});

		const messages = response.data.messages || [];
		
		// Get details
		const detailedMessages = await Promise.all(
			messages.slice(0, 10).map(async (msg) => {
				const details = await gmail.users.messages.get({
					userId: 'me',
					id: msg.id,
					format: 'metadata',
					metadataHeaders: ['From', 'Subject', 'Date']
				});
				return details.data;
			})
		);

		res.json({
			ok: true,
			messages: detailedMessages,
			total: response.data.resultSizeEstimate || 0,
			warning: check.warning
		});
	} catch (error) {
		console.error("[Gmail Unread]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Gmail: Get important emails today
app.post("/mcp/tools/gmail/important-today", async (req, res) => {
	try {
		if (!googleAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Please login to use Gmail features"
			});
		}

		const check = await billingService.checkAndUpdateUsage('gmail', 'search');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		await googleAuth.ensureValidTokens();
		const auth = googleAuth.getClient();
		const gmail = google.gmail({ version: 'v1', auth });

		const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
		const maxResults = req.body.maxResults || 20;

		const response = await gmail.users.messages.list({
			userId: 'me',
			q: `is:important after:${today}`,
			maxResults
		});

		const messages = response.data.messages || [];
		
		// Get details
		const detailedMessages = await Promise.all(
			messages.map(async (msg) => {
				const details = await gmail.users.messages.get({
					userId: 'me',
					id: msg.id,
					format: 'metadata',
					metadataHeaders: ['From', 'Subject', 'Date']
				});
				return details.data;
			})
		);

		res.json({
			ok: true,
			messages: detailedMessages,
			total: messages.length,
			date: today,
			warning: check.warning
		});
	} catch (error) {
		console.error("[Gmail Important]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// ============================================================================
// GOOGLE CALENDAR MCP TOOLS
// ============================================================================

// Calendar: Today's events
app.post("/mcp/tools/calendar/today", async (req, res) => {
	try {
		if (!googleAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Please login to use Calendar features"
			});
		}

		const check = await billingService.checkAndUpdateUsage('calendar', 'list');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		await googleAuth.ensureValidTokens();
		const auth = googleAuth.getClient();
		const calendar = google.calendar({ version: 'v3', auth });

		const now = new Date();
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

		const response = await calendar.events.list({
			calendarId: 'primary',
			timeMin: startOfDay.toISOString(),
			timeMax: endOfDay.toISOString(),
			singleEvents: true,
			orderBy: 'startTime'
		});

		res.json({
			ok: true,
			events: response.data.items || [],
			date: startOfDay.toISOString().split('T')[0],
			warning: check.warning
		});
	} catch (error) {
		console.error("[Calendar Today]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Calendar: Upcoming events
app.post("/mcp/tools/calendar/upcoming", async (req, res) => {
	try {
		if (!googleAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Please login to use Calendar features"
			});
		}

		const check = await billingService.checkAndUpdateUsage('calendar', 'list');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		await googleAuth.ensureValidTokens();
		const auth = googleAuth.getClient();
		const calendar = google.calendar({ version: 'v3', auth });

		const days = req.body.days || 7;
		const now = new Date();
		const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

		const response = await calendar.events.list({
			calendarId: 'primary',
			timeMin: now.toISOString(),
			timeMax: future.toISOString(),
			singleEvents: true,
			orderBy: 'startTime',
			maxResults: 50
		});

		res.json({
			ok: true,
			events: response.data.items || [],
			days: days,
			warning: check.warning
		});
	} catch (error) {
		console.error("[Calendar Upcoming]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// ============================================================================
// SLACK MCP TOOLS
// ============================================================================

const slackAuth = require("./slackAuthService.cjs");

// Slack: Search messages
app.post("/mcp/tools/slack/search", async (req, res) => {
	try {
		if (!slackAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Slack token not configured. Set SLACK_BOT_TOKEN or SLACK_USER_TOKEN in .env"
			});
		}

		const check = await billingService.checkAndUpdateUsage('slack', 'search');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const query = req.body.query;
		if (!query) {
			return res.status(400).json({ ok: false, error: "Query is required" });
		}

		const result = await slackAuth.searchMessages(query, {
			count: req.body.maxResults || 20
		});

		res.json({
			ok: true,
			messages: result.messages?.matches || [],
			total: result.messages?.total || 0,
			warning: check.warning
		});
	} catch (error) {
		console.error("[Slack Search]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Slack: List channels
app.post("/mcp/tools/slack/channels", async (req, res) => {
	try {
		if (!slackAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Slack token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('slack', 'list');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const result = await slackAuth.listChannels();

		res.json({
			ok: true,
			channels: result.channels.map(ch => ({
				id: ch.id,
				name: ch.name,
				is_private: ch.is_private,
				is_archived: ch.is_archived,
				num_members: ch.num_members
			})),
			warning: check.warning
		});
	} catch (error) {
		console.error("[Slack Channels]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Slack: Get channel messages
app.post("/mcp/tools/slack/channel-messages", async (req, res) => {
	try {
		if (!slackAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Slack token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('slack', 'history');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const channelName = req.body.channel;
		if (!channelName) {
			return res.status(400).json({ ok: false, error: "Channel name is required" });
		}

		// Find channel by name
		const channel = await slackAuth.findChannelByName(channelName);
		
		// Get messages
		const result = await slackAuth.getChannelHistory(channel.id, {
			limit: req.body.limit || 100
		});

		res.json({
			ok: true,
			channel: {
				id: channel.id,
				name: channel.name
			},
			messages: result.messages || [],
			warning: check.warning
		});
	} catch (error) {
		console.error("[Slack Channel Messages]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Slack: Count messages from user in channel
app.post("/mcp/tools/slack/count-from-user", async (req, res) => {
	try {
		if (!slackAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Slack token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('slack', 'history');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const { channel: channelName, user: userName } = req.body;
		if (!channelName || !userName) {
			return res.status(400).json({ ok: false, error: "Channel and user are required" });
		}

		// Find channel and user
		const channel = await slackAuth.findChannelByName(channelName);
		const user = await slackAuth.findUserByName(userName);

		// Get messages and count from user
		const result = await slackAuth.getChannelHistory(channel.id, { limit: 1000 });
		const userMessages = (result.messages || []).filter(msg => msg.user === user.id);

		res.json({
			ok: true,
			count: userMessages.length,
			channel: channel.name,
			user: user.name,
			warning: check.warning
		});
	} catch (error) {
		console.error("[Slack Count From User]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Slack: Get latest message in channel
app.post("/mcp/tools/slack/latest-message", async (req, res) => {
	try {
		if (!slackAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Slack token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('slack', 'history');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const channelName = req.body.channel;
		if (!channelName) {
			return res.status(400).json({ ok: false, error: "Channel name is required" });
		}

		// Find channel
		const channel = await slackAuth.findChannelByName(channelName);
		
		// Get latest message
		const result = await slackAuth.getChannelHistory(channel.id, { limit: 1 });
		const latestMessage = result.messages?.[0];

		if (!latestMessage) {
			return res.json({
				ok: true,
				found: false,
				channel: channel.name
			});
		}

		// Get user info for the message
		let userName = 'Unknown';
		try {
			const userInfo = await slackAuth.getUserInfo(latestMessage.user);
			userName = userInfo.user.name;
		} catch (err) {
			console.warn("[Slack] Could not fetch user info:", err.message);
		}

		res.json({
			ok: true,
			found: true,
			channel: channel.name,
			message: {
				text: latestMessage.text,
				user: userName,
				timestamp: latestMessage.ts,
				date: new Date(parseFloat(latestMessage.ts) * 1000).toISOString()
			},
			warning: check.warning
		});
	} catch (error) {
		console.error("[Slack Latest Message]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// Slack: Get mentions (unread)
app.post("/mcp/tools/slack/mentions", async (req, res) => {
	try {
		if (!slackAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "Slack token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('slack', 'search');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		// Get workspace info to get current user ID
		const workspace = await slackAuth.getWorkspaceInfo();
		const userId = workspace.user_id;

		// Search for mentions
		const result = await slackAuth.searchMessages(`<@${userId}>`, {
			count: 50,
			sort: 'timestamp',
			sortDir: 'desc'
		});

		res.json({
			ok: true,
			mentions: result.messages?.matches || [],
			total: result.messages?.total || 0,
			warning: check.warning
		});
	} catch (error) {
		console.error("[Slack Mentions]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// ============================================================================
// GITHUB MCP TOOLS
// ============================================================================

const githubAuth = require("./githubAuthService.cjs");

// GitHub: List repositories
app.post("/mcp/tools/github/repos", async (req, res) => {
	try {
		if (!githubAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "GitHub token not configured. Set GITHUB_TOKEN in .env"
			});
		}

		const check = await billingService.checkAndUpdateUsage('github', 'list');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const repos = await githubAuth.listRepositories({
			type: req.body.type || 'all',
			sort: req.body.sort || 'updated'
		});

		res.json({
			ok: true,
			repositories: repos.map(r => ({
				name: r.name,
				full_name: r.full_name,
				description: r.description,
				language: r.language,
				stars: r.stargazers_count,
				forks: r.forks_count,
				updated_at: r.updated_at,
				url: r.html_url,
				private: r.private
			})),
			total: repos.length,
			warning: check.warning
		});
	} catch (error) {
		console.error("[GitHub List Repos]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// GitHub: Get repository details
app.post("/mcp/tools/github/repo-details", async (req, res) => {
	try {
		if (!githubAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "GitHub token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('github', 'get');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const repoName = req.body.repo;
		if (!repoName) {
			return res.status(400).json({ ok: false, error: "Repository name is required" });
		}

		const repo = await githubAuth.getRepository(repoName);

		res.json({
			ok: true,
			repository: {
				name: repo.name,
				full_name: repo.full_name,
				description: repo.description,
				language: repo.language,
				stars: repo.stargazers_count,
				forks: repo.forks_count,
				watchers: repo.watchers_count,
				open_issues: repo.open_issues_count,
				created_at: repo.created_at,
				updated_at: repo.updated_at,
				pushed_at: repo.pushed_at,
				size: repo.size,
				default_branch: repo.default_branch,
				url: repo.html_url,
				homepage: repo.homepage,
				topics: repo.topics,
				license: repo.license?.name
			},
			warning: check.warning
		});
	} catch (error) {
		console.error("[GitHub Repo Details]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// GitHub: List commits
app.post("/mcp/tools/github/commits", async (req, res) => {
	try {
		if (!githubAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "GitHub token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('github', 'list');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const repoName = req.body.repo;
		if (!repoName) {
			return res.status(400).json({ ok: false, error: "Repository name is required" });
		}

		const commits = await githubAuth.listCommits(repoName, {
			perPage: req.body.limit || 30,
			branch: req.body.branch
		});

		res.json({
			ok: true,
			repository: repoName,
			commits: commits.map(c => ({
				sha: c.sha.substring(0, 7),
				full_sha: c.sha,
				message: c.commit.message,
				author: c.commit.author.name,
				date: c.commit.author.date,
				url: c.html_url
			})),
			total: commits.length,
			warning: check.warning
		});
	} catch (error) {
		console.error("[GitHub Commits]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// GitHub: Get commit details
app.post("/mcp/tools/github/commit-details", async (req, res) => {
	try {
		if (!githubAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "GitHub token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('github', 'get');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const { repo, sha } = req.body;
		if (!repo || !sha) {
			return res.status(400).json({ ok: false, error: "Repository and SHA are required" });
		}

		const commit = await githubAuth.getCommit(repo, sha);

		res.json({
			ok: true,
			commit: {
				sha: commit.sha.substring(0, 7),
				full_sha: commit.sha,
				message: commit.commit.message,
				author: {
					name: commit.commit.author.name,
					email: commit.commit.author.email,
					date: commit.commit.author.date
				},
				committer: {
					name: commit.commit.committer.name,
					date: commit.commit.committer.date
				},
				stats: commit.stats,
				files: commit.files?.map(f => ({
					filename: f.filename,
					status: f.status,
					additions: f.additions,
					deletions: f.deletions,
					changes: f.changes
				})),
				url: commit.html_url
			},
			warning: check.warning
		});
	} catch (error) {
		console.error("[GitHub Commit Details]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// GitHub: Search code
app.post("/mcp/tools/github/search-code", async (req, res) => {
	try {
		if (!githubAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "GitHub token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('github', 'search');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const query = req.body.query;
		if (!query) {
			return res.status(400).json({ ok: false, error: "Search query is required" });
		}

		const result = await githubAuth.searchCode(query, {
			perPage: req.body.limit || 20
		});

		res.json({
			ok: true,
			items: result.items.map(item => ({
				name: item.name,
				path: item.path,
				repository: item.repository.name,
				url: item.html_url,
				score: item.score
			})),
			total: result.total_count,
			warning: check.warning
		});
	} catch (error) {
		console.error("[GitHub Search Code]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// GitHub: List pull requests
app.post("/mcp/tools/github/pull-requests", async (req, res) => {
	try {
		if (!githubAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "GitHub token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('github', 'list');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const repoName = req.body.repo;
		if (!repoName) {
			return res.status(400).json({ ok: false, error: "Repository name is required" });
		}

		const prs = await githubAuth.listPullRequests(repoName, {
			state: req.body.state || 'open'
		});

		res.json({
			ok: true,
			repository: repoName,
			pull_requests: prs.map(pr => ({
				number: pr.number,
				title: pr.title,
				state: pr.state,
				author: pr.user.login,
				created_at: pr.created_at,
				updated_at: pr.updated_at,
				url: pr.html_url
			})),
			total: prs.length,
			warning: check.warning
		});
	} catch (error) {
		console.error("[GitHub Pull Requests]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

// GitHub: List issues
app.post("/mcp/tools/github/issues", async (req, res) => {
	try {
		if (!githubAuth.isAuthenticated()) {
			return res.status(401).json({
				ok: false,
				error: "Not authenticated",
				message: "GitHub token not configured"
			});
		}

		const check = await billingService.checkAndUpdateUsage('github', 'list');
		if (!check.allowed) {
			return res.status(403).json({
				ok: false,
				blocked: true,
				message: check.message
			});
		}

		const repoName = req.body.repo;
		if (!repoName) {
			return res.status(400).json({ ok: false, error: "Repository name is required" });
		}

		const issues = await githubAuth.listIssues(repoName, {
			state: req.body.state || 'open'
		});

		// Filter out pull requests (GitHub treats PRs as issues)
		const actualIssues = issues.filter(issue => !issue.pull_request);

		res.json({
			ok: true,
			repository: repoName,
			issues: actualIssues.map(issue => ({
				number: issue.number,
				title: issue.title,
				state: issue.state,
				author: issue.user.login,
				labels: issue.labels.map(l => l.name),
				created_at: issue.created_at,
				updated_at: issue.updated_at,
				url: issue.html_url
			})),
			total: actualIssues.length,
			warning: check.warning
		});
	} catch (error) {
		console.error("[GitHub Issues]", error.message);
		res.status(500).json({ ok: false, error: error.message });
	}
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
	console.log(`[proxy] listening on http://localhost:${PORT}`);
});


