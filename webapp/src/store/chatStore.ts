import { create } from "zustand";
import { set, get } from "idb-keyval";
import { z } from "zod";
import { sendWithProvider, type AttachmentInput } from "../vendor/llm";

export type Role = "user" | "assistant" | "system";

export type Attachment = {
	id: string;
	type: "image";
	name: string;
	dataUrl: string;
};

export type Message = {
	id: string;
	role: Role;
	content: string;
	attachments?: Attachment[];
	createdAt: number;
	status?: "streaming" | "complete" | "error";
};

export type Conversation = {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageIds: string[];
	messages: Message[];
};

export type Provider = "ollama" | "openai" | "gemini";

export type Settings = {
	provider: Provider;
	model: string;
	apiKey?: string;
	baseUrl?: string;
	temperature: number;
	maxTokens?: number;
	autoTts?: boolean;
	autoLang?: boolean;
	speechLang?: string;
	ttsVoice?: string;
	ttsRate?: number;
	ttsPitch?: number;
};

type UiState = {
	showSettings: boolean;
	leftWidth?: number;
	rightWidth?: number;
	rightTopHeight?: number;
	micOn?: boolean;
	speakerOn?: boolean;
};

type ChatState = {
	conversations: Conversation[];
	activeConversationId?: string;
	settings: Settings;
	ui: UiState;
	activeTools: Record<string, boolean>;
	ensureInitialized: () => Promise<void>;
	createConversation: () => void;
	setActiveConversationId: (id: string) => void;
	updateSettings: (s: Settings) => void;
	setUi: (ui: Partial<UiState>) => void;
	deleteConversation: (id: string) => Promise<void>;
	renameConversation: (id: string, title: string) => Promise<void>;
	setToolActive: (name: string, active: boolean) => void;
	sendMessage: (content: string, attachments?: AttachmentInput[]) => Promise<void>;
};

const SETTINGS_KEY = "app.settings.v1";
const CONV_KEY = "app.conversations.v1";
const UI_SIZES_KEY = "app.ui.sizes.v1";
const MCP_ACTIVE_KEY = "app.mcp.active.v1";

const DEFAULT_ACTIVE_TOOLS: Record<string, boolean> = {
	// Enable Jira tools by default so they work out of the box
	jira_list_projects: true,
	jira_get_issue: true,
	jira_search: true,
	jira_list_issues: true,
	jira_issue_status: true,
	jira_sprints: true,
	jira_issue_details: true,
	jira_boards_for_project: true,
	// Enable Slack tools by default
	slack_search: true,
	slack_channels: true,
	slack_channel_messages: true,
	slack_count_from_user: true,
	slack_latest_message: true,
	slack_mentions: true,
	// Other sample tools
	add: true,
	weather: true,
};

const settingsSchema = z.object({
	provider: z.enum(["ollama", "openai", "gemini"]),
	model: z.string(),
	apiKey: z.string().optional(),
	baseUrl: z.string().optional(),
	temperature: z.number().min(0).max(2),
	maxTokens: z.number().optional(),
	autoTts: z.boolean().optional(),
	autoLang: z.boolean().optional(),
	speechLang: z.string().optional(),
	ttsVoice: z.string().optional(),
	ttsRate: z.number().optional(),
	ttsPitch: z.number().optional(),
}) satisfies z.ZodType<Settings>;

export const useChatStore = create<ChatState>((set, getState) => ({
	conversations: [],
	activeConversationId: undefined,
	settings: {
		provider: "ollama",
		model: "llama3.2:3b",
		temperature: 0.7,
		autoTts: true,
		autoLang: true,
		speechLang: "en-US",
		ttsVoice: undefined,
		ttsRate: 1,
		ttsPitch: 1,
	},
	ui: {
		showSettings: false,
		leftWidth: 280,
		rightWidth: 320,
		rightTopHeight: 240,
		micOn: false,
		speakerOn: false,
	},
	activeTools: { ...DEFAULT_ACTIVE_TOOLS },
	ensureInitialized: async () => {
		const [rawSettings, rawConversations, rawUiSizes, rawActiveTools] = await Promise.all([
			get(SETTINGS_KEY).catch(() => undefined),
			get(CONV_KEY).catch(() => undefined),
			Promise.resolve().then(() => {
				try {
					const v = localStorage.getItem(UI_SIZES_KEY);
					return v ? JSON.parse(v) : undefined;
				} catch { return undefined; }
			}),
			Promise.resolve().then(() => {
				try {
					const v = localStorage.getItem(MCP_ACTIVE_KEY);
					return v ? JSON.parse(v) : undefined;
				} catch { return undefined; }
			}),
		]);
		if (rawSettings) {
			const parsed = settingsSchema.safeParse(rawSettings);
			if (parsed.success) {
				set({
					settings: {
						provider: parsed.data.provider,
						model: parsed.data.model,
						apiKey: parsed.data.apiKey,
						baseUrl: parsed.data.baseUrl,
						temperature: parsed.data.temperature ?? 0.7,
						maxTokens: parsed.data.maxTokens,
						autoTts: parsed.data.autoTts ?? true,
						autoLang: parsed.data.autoLang ?? true,
						speechLang: parsed.data.speechLang,
						ttsVoice: parsed.data.ttsVoice,
						ttsRate: parsed.data.ttsRate ?? 1,
						ttsPitch: parsed.data.ttsPitch ?? 1,
					},
				});
			}
		}
		if (rawUiSizes && typeof rawUiSizes === "object") {
			const uiSizesClean: Partial<UiState> = {
				leftWidth: (rawUiSizes as any).leftWidth,
				rightWidth: (rawUiSizes as any).rightWidth,
				rightTopHeight: (rawUiSizes as any).rightTopHeight,
			};
			set(state => ({ ui: { ...state.ui, ...uiSizesClean } }));
		}
		if (rawActiveTools && typeof rawActiveTools === "object") {
			// Merge persisted choices over sensible defaults so new tools come online automatically
			set({ activeTools: { ...DEFAULT_ACTIVE_TOOLS, ...rawActiveTools } });
		}
		if (Array.isArray(rawConversations)) {
			set({ conversations: rawConversations });
			if (rawConversations.length > 0) set({ activeConversationId: rawConversations[0].id });
		} else {
			const id = generateId();
			const conv: Conversation = {
				id,
				title: "New chat",
				createdAt: Date.now(),
				updatedAt: Date.now(),
				messageIds: [],
				messages: [],
			};
			set({ conversations: [conv], activeConversationId: id });
			await setDb(CONV_KEY, [conv]);
		}
	},
	createConversation: async () => {
		const id = generateId();
		const conv: Conversation = {
			id,
			title: "New chat",
			createdAt: Date.now(),
			updatedAt: Date.now(),
			messageIds: [],
			messages: [],
		};
		set(state => ({ conversations: [conv, ...state.conversations], activeConversationId: id }));
		await setDb(CONV_KEY, getState().conversations);
	},
	setActiveConversationId: (id) => set({ activeConversationId: id }),
	updateSettings: async (s) => {
		const parsed = settingsSchema.parse(s);
		const next: Settings = {
			provider: parsed.provider,
			model: parsed.model,
			apiKey: parsed.apiKey,
			baseUrl: parsed.baseUrl,
			temperature: parsed.temperature ?? 0.7,
			maxTokens: parsed.maxTokens,
			autoTts: parsed.autoTts ?? true,
			autoLang: parsed.autoLang ?? true,
			speechLang: parsed.speechLang,
			ttsVoice: parsed.ttsVoice,
			ttsRate: parsed.ttsRate ?? 1,
			ttsPitch: parsed.ttsPitch ?? 1,
		};
		set({ settings: next });
		await setDb(SETTINGS_KEY, next);
	},
	setUi: (ui) => {
		set(state => {
			const next = { ui: { ...state.ui, ...ui } };
			try {
				const toPersist = {
					leftWidth: next.ui.leftWidth,
					rightWidth: next.ui.rightWidth,
					rightTopHeight: next.ui.rightTopHeight,
				};
				localStorage.setItem(UI_SIZES_KEY, JSON.stringify(toPersist));
			} catch {}
			return next;
		});
	},
	setToolActive: (name, active) => {
		set(state => {
			const next = { ...state.activeTools, [name]: active };
			try {
				localStorage.setItem(MCP_ACTIVE_KEY, JSON.stringify(next));
			} catch {}
			return { activeTools: next };
		});
	},
	deleteConversation: async (id: string) => {
		const state = getState();
		const remaining = state.conversations.filter(c => c.id !== id);
		let nextActive = state.activeConversationId;
		if (state.activeConversationId === id) {
			nextActive = remaining[0]?.id;
		}
		if (!remaining.length) {
			const newId = generateId();
			const conv: Conversation = {
				id: newId,
				title: "New chat",
				createdAt: Date.now(),
				updatedAt: Date.now(),
				messageIds: [],
				messages: [],
			};
			set({ conversations: [conv], activeConversationId: conv.id });
			await setDb(CONV_KEY, getState().conversations);
			return;
		}
		set({ conversations: remaining, activeConversationId: nextActive });
		await setDb(CONV_KEY, getState().conversations);
	},
	renameConversation: async (id, title) => {
		const t = title.trim() || "Untitled chat";
		set(state => {
			const updated = state.conversations.map(c => c.id === id ? { ...c, title: t, updatedAt: Date.now() } : c);
			return { conversations: updated };
		});
		await setDb(CONV_KEY, getState().conversations);
	},
	sendMessage: async (content, attachments) => {
		const state = getState();
		const convId = state.activeConversationId!;
		const conv = state.conversations.find(c => c.id === convId);
		if (!conv) return;
		// Language detection on user message (typed or STT) to adapt STT locale and LLM reply language
		let replyLang: "en" | "fr" = detectLang(content);
		if (state.settings.autoLang) {
			const desiredSpeechLang = replyLang === "fr" ? "fr-FR" : "en-US";
			if (desiredSpeechLang !== state.settings.speechLang) {
				set({ settings: { ...state.settings, speechLang: desiredSpeechLang } });
				await setDb(SETTINGS_KEY, getState().settings);
			}
		}
		const isToolAddActive = !!state.activeTools?.["add"];
		const userMsg: Message = {
			id: generateId(),
			role: "user",
			content,
			attachments: attachments?.map(a => ({ ...a, type: "image" })),
			createdAt: Date.now(),
			status: "complete",
		};
		const assistantMsg: Message = {
			id: generateId(),
			role: "assistant",
			content: "",
			createdAt: Date.now(),
			status: "streaming",
		};
		conv.messages.push(userMsg, assistantMsg);
		conv.messageIds.push(userMsg.id, assistantMsg.id);
		conv.updatedAt = Date.now();
		set({ conversations: [...state.conversations] });
		await setDb(CONV_KEY, getState().conversations);

		try {
			// MCP Tool: Jira - list projects/spaces (but NOT if asking for tasks/issues OF projects)
			if (getState().activeTools?.["jira_list_projects"]) {
				// Only match if NOT asking for tasks/issues OF projects (use non-greedy match)
				const hasTasksOrIssues = /\b(tasks?|issues?)\b.{0,50}?\b(of|in|from|for)\b.{0,30}?\b(projects?|spaces?)\b/i.test(content);
				const wantProjects = /\b(list|show)\s+(my\s+)?(jira\s+)?(projects|spaces)\b/i.test(content);
				if (wantProjects && !hasTasksOrIssues) {
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/jira/projects");
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const items: Array<any> = json.projects || [];
							const lines = items.slice(0, 100).map((p: any) => `- ${p.name} (${p.key || p.id})`);
							assistantMsg.content = lines.length ? `Jira projects:\n${lines.join("\n")}` : "No projects found.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {
						// fall through
					}
				}
			}
			// MCP Tool: add two numbers if the tool is active and the prompt contains a+b
			if (isToolAddActive) {
				const addMatch = content.match(/(-?\d+(?:\.\d+)?)\s*\+\s*(-?\d+(?:\.\d+)?)/);
				if (addMatch) {
					const a = Number(addMatch[1]);
					const b = Number(addMatch[2]);
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/add", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ a, b }),
						});
						if (resp.ok) {
							const json = await resp.json();
							if (json?.ok) {
								assistantMsg.content = String(json.result);
								assistantMsg.status = "complete";
								set({ conversations: [...getState().conversations] });
								await setDb(CONV_KEY, getState().conversations);
								return;
							}
						}
					} catch {
						// fall back to LLM below on failure
					}
				}
			}
			// MCP Tool: Jira - get issue by key (e.g., ABC-123)
			if (getState().activeTools?.["jira_get_issue"]) {
				const issueMatch = content.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
				if (issueMatch) {
					const key = issueMatch[1];
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/jira/issue", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ key }),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const i = json.issue || {};
							const summary = i.fields?.summary || "(no summary)";
							const status = i.fields?.status?.name || "(unknown)";
							const assignee = i.fields?.assignee?.displayName || "(unassigned)";
							const urlBase = (typeof window !== "undefined" && window.location) ? "" : "";
							assistantMsg.content =
								`Issue ${key}\n- Summary: ${summary}\n- Status: ${status}\n- Assignee: ${assignee}`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {
						// fall through
					}
				}
			}
			// MCP Tool: Jira - search via JQL: prefix (e.g., "jql: project=ABC AND status='In Progress'")
			if (getState().activeTools?.["jira_search"]) {
				// Case 0: "details for all <PROJECT_KEY>" or "details for all <ISSUE-PREFIX> in <PROJECT>"
				const allDetailsMatch = content.match(/\bdetails?\s+for\s+all\s+([A-Za-z0-9_-]+)(?:\s+(?:in|for)\s+(?:project|space)?\s*([A-Za-z0-9_-]+))?\b/i);
				if (allDetailsMatch) {
					let projKey = allDetailsMatch[2] || allDetailsMatch[1]; // Use second group if present (project name), else first
					const issuePrefix = allDetailsMatch[2] ? allDetailsMatch[1] : null; // If second group exists, first is issue prefix
					
					// Resolve project name -> key if needed
					try {
						const pResp = await fetch("http://localhost:3001/mcp/tools/jira/projects");
						const pJson = await pResp.json();
						if (pResp.ok && pJson?.ok) {
							const projects: Array<any> = pJson.projects || [];
							const direct = projects.find((p: any) => String(p.key).toLowerCase() === projKey.toLowerCase());
							if (!direct) {
								const byName = projects.find((p: any) => String(p.name).toLowerCase() === projKey.toLowerCase());
								if (byName) projKey = byName.key;
							} else {
								projKey = direct.key;
							}
						}
					} catch (err) {
						assistantMsg.content = `Failed to fetch projects: ${err instanceof Error ? err.message : "unknown error"}`;
						assistantMsg.status = "complete";
						set({ conversations: [...getState().conversations] });
						await setDb(CONV_KEY, getState().conversations);
						return;
					}
					// Run JQL for that project
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/jira/search", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ jql: `project=${projKey} ORDER BY created DESC`, maxResults: 100 }),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const issues: Array<any> = json.issues || [];
							const total = json.total || 0;
							const lines = issues.map((it: any) => {
								const f = it.fields || {};
								const status = f.status?.name || "?";
								const assignee = f.assignee?.displayName || "unassigned";
								const due = f.duedate ? ` due ${f.duedate}` : "";
								return `- ${it.key}: ${f.summary || "(no summary)"} [${status}] (${assignee})${due}`;
							});
							const countText = total > issues.length ? ` (showing ${issues.length} of ${total})` : ` (${issues.length} total)`;
							assistantMsg.content = lines.length ? `Details for all in ${projKey}${countText}:\n${lines.join("\n")}` : `No issues found in ${projKey}.`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else {
							const errorMsg = json?.error || json?.errorMessages || (resp?.status ? `HTTP ${resp.status}` : "unknown error");
							assistantMsg.content = `Jira search failed: ${errorMsg}`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch (err) {
						assistantMsg.content = `Jira search failed: ${err instanceof Error ? err.message : "network or server error"}`;
						assistantMsg.status = "complete";
						set({ conversations: [...getState().conversations] });
						await setDb(CONV_KEY, getState().conversations);
						return;
					}
				}
				const jqlMatch = content.match(/jql:\s*(.+)$/i);
				// Helper to run a JQL and respond, with fallback to board API if search is blocked
				const runJql = async (jql: string) => {
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/jira/search", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ jql, maxResults: 100 }),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const issues: Array<any> = json.issues || [];
							const total = json.total || 0;
							const lines = issues.map((it: any) => {
								const f = it.fields || {};
								const status = f.status?.name || "?";
								const assignee = f.assignee?.displayName || "unassigned";
								const due = f.duedate ? ` due ${f.duedate}` : "";
								return `- ${it.key}: ${f.summary || "(no summary)"} [${status}] (${assignee})${due}`;
							});
							const resultText = lines.length ? lines.join("\n") : "No issues found.";
							const countText = total > issues.length ? ` (showing ${issues.length} of ${total})` : ` (${issues.length} total)`;
							assistantMsg.content = `Search results${countText}:\n${resultText}`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return true;
						} else if (resp.status === 410 && jql.includes("project=")) {
							// Fallback: Search API blocked, try board API instead
							const projectMatch = jql.match(/project=([A-Z]+)/i);
							if (projectMatch) {
								const projectKey = projectMatch[1];
								try {
									// Get boards for the project
									const boardsResp = await fetch("http://localhost:3001/mcp/tools/jira/boardsByProject", {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ projectKey }),
									});
									const boardsJson = await boardsResp.json();
									if (boardsResp.ok && boardsJson?.ok) {
										const boards = boardsJson.boards || [];
										const allIssues: Array<any> = [];
										
										// Get issues from each board
										for (const board of boards) {
											try {
												const issuesResp = await fetch("http://localhost:3001/mcp/tools/jira/boardIssues", {
													method: "POST",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({ boardId: board.id, maxResults: 100 }),
												});
												const issuesJson = await issuesResp.json();
												if (issuesResp.ok && issuesJson?.ok) {
													allIssues.push(...(issuesJson.issues || []));
												}
											} catch {}
										}
										
										// Deduplicate by key
										const uniqueIssues = Array.from(new Map(allIssues.map(i => [i.key, i])).values());
										const lines = uniqueIssues.map((it: any) => {
											const f = it.fields || {};
											const status = f.status?.name || "?";
											const assignee = f.assignee?.displayName || "unassigned";
											return `- ${it.key}: ${f.summary || "(no summary)"} [${status}] (${assignee})`;
										});
										assistantMsg.content = lines.length 
											? `Issues in ${projectKey} (${uniqueIssues.length} total, via board API):\n${lines.join("\n")}`
											: `No issues found in ${projectKey}.`;
										assistantMsg.status = "complete";
										set({ conversations: [...getState().conversations] });
										await setDb(CONV_KEY, getState().conversations);
										return true;
									}
								} catch {}
							}
							// If fallback fails, show error
							const errorMsg = json?.error || json?.errorMessages || `HTTP ${resp.status}`;
							assistantMsg.content = `Jira search API is blocked (HTTP 410). Fallback to board API also failed. Try: "list boards of ${projectMatch?.[1] || 'project'}" then "list all tasks in board X"`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return true;
						} else {
							// Show detailed error
							const errorMsg = json?.error || json?.errorMessages || `HTTP ${resp.status}`;
							assistantMsg.content = `Jira search failed: ${errorMsg}`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return true;
						}
					} catch (err) {
						assistantMsg.content = `Jira search failed: ${err instanceof Error ? err.message : "network or server error"}`;
						assistantMsg.status = "complete";
						set({ conversations: [...getState().conversations] });
						await setDb(CONV_KEY, getState().conversations);
						return true;
					}
				};

				// Case 1: explicit JQL
				if (jqlMatch) {
					const jql = jqlMatch[1].trim();
					const ok = await runJql(jql);
					if (ok) return;
				} else {
					// Case 2: Check if user wants ALL tasks from ALL projects
					const wantsAllProjects = /\b(all|my)\s+(?:jira\s+)?projects?\b/i.test(content) || 
					                         /\b(?:of|from|in|across)\s+(all|my)\s+projects?\b/i.test(content);
					
					if (wantsAllProjects) {
						// List all tasks across all projects (no project filter)
						const ok = await runJql(`ORDER BY created DESC`);
						if (ok) return;
					}
					
					// Case 3: natural language like "list/get/show issues (in/of/from project|space X)"
					// Updated to also match "tasks", "tasks/issues", "issues/tasks" and "of/from" prepositions
					const nl = /\b(get|list|show)\s+(all\s+)?(?:tasks?(?:\/issues?)?|issues?(?:\/tasks?)?)(?:\s+(?:in|of|from)\s+(?:(?:project|space)\s+)?([A-Za-z0-9_-]+|["'][^"']+["']))?/i;
					const m = content.match(nl);
					if (m) {
						let projHintRaw = m[3]?.trim();
						let projHint = projHintRaw ? projHintRaw.replace(/^["']|["']$/g, "") : "";
						// Fetch projects to resolve key by name or pick the only project
						try {
							const pResp = await fetch("http://localhost:3001/mcp/tools/jira/projects");
							const pJson = await pResp.json();
							if (pResp.ok && pJson?.ok) {
								const projects: Array<any> = pJson.projects || [];
								let projectKey = "";
								if (projHint) {
                                    // If hint already looks like KEY (ABC-123 style is for issues; project keys are like ABC)
									const direct = projects.find((p: any) => String(p.key).toLowerCase() === projHint.toLowerCase());
									if (direct) projectKey = direct.key;
									else {
										// try by name
										const byName = projects.find((p: any) => String(p.name).toLowerCase() === projHint.toLowerCase());
										if (byName) projectKey = byName.key;
									}
								} else if (projects.length === 1) {
									projectKey = projects[0].key;
								}
								if (projectKey) {
									const ok = await runJql(`project=${projectKey} ORDER BY created DESC`);
									if (ok) return;
								} else if (!projHint) {
									// No hint and multiple projects -> ask user to specify
									const list = projects.slice(0, 20).map((p: any) => `${p.name} (${p.key})`).join(", ");
									assistantMsg.content = `Which project? Available: ${list}`;
									assistantMsg.status = "complete";
									set({ conversations: [...getState().conversations] });
									await setDb(CONV_KEY, getState().conversations);
									return;
								}
							}
						} catch (err) {
							assistantMsg.content = `Failed to fetch projects: ${err instanceof Error ? err.message : "unknown error"}`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					}
				}
			}
			// MCP Tool: Jira - list boards in project/space
			if (getState().activeTools?.["jira_boards_for_project"]) {
				// Check if user wants boards from ALL projects
				const wantsAllProjectBoards = /\bboards?\s+(?:of|from|in|across)\s+(?:all|my)\s+(?:jira\s+)?projects?\b/i.test(content);
				
				if (wantsAllProjectBoards) {
					// List boards from all projects
					try {
						const pResp = await fetch("http://localhost:3001/mcp/tools/jira/projects");
						const pJson = await pResp.json();
						if (pResp.ok && pJson?.ok) {
							const projects: Array<any> = pJson.projects || [];
							const allBoards: Array<any> = [];
							
							// Fetch boards for each project
							for (const proj of projects) {
								try {
									const resp = await fetch("http://localhost:3001/mcp/tools/jira/boardsByProject", {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ projectKey: proj.key }),
									});
									const json = await resp.json();
									if (resp.ok && json?.ok) {
										const boards = json.boards || [];
										boards.forEach((b: any) => {
											allBoards.push({ ...b, projectName: proj.name, projectKey: proj.key });
										});
									}
								} catch {}
							}
							
							const lines = allBoards.map((b: any) => `- ${b.name} (id ${b.id}) [${b.type}] - ${b.projectName}`);
							assistantMsg.content = lines.length ? `All boards:\n${lines.join("\n")}` : "No boards found.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else {
							assistantMsg.content = `Failed to fetch projects for boards.`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch (err) {
						assistantMsg.content = `Error fetching boards: ${err instanceof Error ? err.message : "unknown error"}`;
						assistantMsg.status = "complete";
						set({ conversations: [...getState().conversations] });
						await setDb(CONV_KEY, getState().conversations);
						return;
					}
				}
				
				const m = content.match(/\b(list|show)\s+(?:all\s+)?boards\s+(?:in|for|of)\s+(?:(?:project|space)\s+)?([A-Za-z0-9_-]+|["'][^"']+["'])/i);
				if (m) {
					let projHint = m[2].replace(/^["']|["']$/g, "");
					try {
						// Resolve project name to key if necessary
						let projectKey = projHint;
						try {
							const pResp = await fetch("http://localhost:3001/mcp/tools/jira/projects");
							const pJson = await pResp.json();
							if (pResp.ok && pJson?.ok) {
								const projects: Array<any> = pJson.projects || [];
								const direct = projects.find((p: any) => String(p.key).toLowerCase() === projHint.toLowerCase());
								if (direct) projectKey = direct.key;
								else {
									const byName = projects.find((p: any) => String(p.name).toLowerCase() === projHint.toLowerCase());
									if (byName) projectKey = byName.key;
								}
							}
						} catch {}

						const resp = await fetch("http://localhost:3001/mcp/tools/jira/boardsByProject", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ projectKey: projectKey }),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const boards: Array<any> = json.boards || [];
							const lines = boards.map((b: any) => `- ${b.name} (id ${b.id}) [${b.type}]`);
							assistantMsg.content = lines.length ? `Boards in ${projHint}:\n${lines.join("\n")}` : `No boards found in ${projHint}.`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {}
				}
			}
			// MCP Tool: Jira - list sprints for board or project
			if (getState().activeTools?.["jira_sprints"]) {
				// list sprints in board 123 OR list sprints in project KEY
				const sb = content.match(/\blist\s+sprints\s+(?:in|for)\s+(?:board\s+)?(\d+)/i);
				if (sb) {
					const boardId = Number(sb[1]);
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/jira/sprints", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ boardId, state: "active" }),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const sprints: Array<any> = json.sprints || [];
							const lines = sprints.map((s: any) => `- ${s.name} (id ${s.id}) [${s.state}]`);
							assistantMsg.content = lines.length ? `Sprints for board ${boardId}:\n${lines.join("\n")}` : `No sprints found for board ${boardId}.`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {}
				}
				const sp = content.match(/\blist\s+sprints\s+(?:in|for)\s+(?:(?:project|space)\s+)?([A-Za-z0-9_-]+|["'][^"']+["'])(?:\s+board\s+([A-Za-z0-9 _-]+|["'][^"']+["']))?/i);
				if (sp) {
					let projKey = sp[1].replace(/^["']|["']$/g, "");
					const boardNameHint = sp[2] ? sp[2].replace(/^["']|["']$/g, "") : "";
					try {
						// First, get boards for project
						// Resolve project name -> key if needed
						try {
							const pResp = await fetch("http://localhost:3001/mcp/tools/jira/projects");
							const pJson = await pResp.json();
							if (pResp.ok && pJson?.ok) {
								const projects: Array<any> = pJson.projects || [];
								const direct = projects.find((p: any) => String(p.key).toLowerCase() === projKey.toLowerCase());
								if (!direct) {
                                    const byName = projects.find((p: any) => String(p.name).toLowerCase() === projKey.toLowerCase());
									if (byName) projKey = byName.key;
								}
							}
						} catch {}
						const bResp = await fetch("http://localhost:3001/mcp/tools/jira/boardsByProject", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ projectKey: projKey }),
						});
						const bJson = await bResp.json();
						if (bResp.ok && bJson?.ok) {
							const boards: Array<any> = bJson.boards || [];
							if (boards.length === 0) {
								assistantMsg.content = `No boards found in project ${projKey}.`;
								assistantMsg.status = "complete";
								set({ conversations: [...getState().conversations] });
								await setDb(CONV_KEY, getState().conversations);
								return;
							}
							let boardId = boards[0].id;
							if (boardNameHint) {
								const byName = boards.find((b: any) => String(b.name).toLowerCase().includes(boardNameHint.toLowerCase()));
								if (byName) boardId = byName.id;
							}
							const sResp = await fetch("http://localhost:3001/mcp/tools/jira/sprints", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ boardId, state: "active" }),
							});
							const sJson = await sResp.json();
							if (sResp.ok && sJson?.ok) {
								const sprints: Array<any> = sJson.sprints || [];
								const lines = sprints.map((s: any) => `- ${s.name} (id ${s.id}) [${s.state}]`);
								assistantMsg.content = lines.length ? `Sprints in ${projKey} (board ${boardId}):\n${lines.join("\n")}` : `No active sprints found in ${projKey}.`;
								assistantMsg.status = "complete";
								set({ conversations: [...getState().conversations] });
								await setDb(CONV_KEY, getState().conversations);
								return;
							}
						}
					} catch {}
				}
			}
			// MCP Tool: Jira - list all issues in a board (including backlog)
			if (getState().activeTools?.["jira_board_issues"]) {
				// Match patterns like "list all tasks/issues in board 1" or "list all issues in that SCRUM board (id 1)"
				const boardIssuesMatch = content.match(/\blist\s+(all\s+)?(?:tasks?(?:\/issues?)?|issues?(?:\/tasks?)?)\s+(?:in|for)\s+(?:that\s+)?(?:[A-Za-z0-9 ]+\s+)?board\s*(?:\(id\s+)?(\d+)\)?/i);
				if (boardIssuesMatch) {
					const boardId = Number(boardIssuesMatch[2]);
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/jira/boardIssues", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ boardId, maxResults: 100 }),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const issues: Array<any> = json.issues || [];
							const total = json.total || 0;
							const lines = issues.map((it: any) => {
								const f = it.fields || {};
								const status = f.status?.name || "?";
								const assignee = f.assignee?.displayName || "unassigned";
								return `- ${it.key}: ${f.summary || "(no summary)"} [${status}] (${assignee})`;
							});
							const countText = total > issues.length ? ` (showing ${issues.length} of ${total})` : ` (${issues.length} total)`;
							assistantMsg.content = lines.length ? `Issues in board ${boardId}${countText}:\n${lines.join("\n")}` : `No issues found in board ${boardId}.`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else {
							const errorMsg = json?.error || `HTTP ${resp.status}`;
							assistantMsg.content = `Failed to fetch board issues: ${errorMsg}`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch (err) {
						assistantMsg.content = `Failed to fetch board issues: ${err instanceof Error ? err.message : "network error"}`;
						assistantMsg.status = "complete";
						set({ conversations: [...getState().conversations] });
						await setDb(CONV_KEY, getState().conversations);
						return;
					}
				}
			}
			// MCP Tool: weather if active and prompt mentions weather in/for/at <location>
			if (getState().activeTools?.["weather"]) {
				// try to extract a location phrase after in/for/at
				const wxRegex = /\bweather\b.*?\b(?:in|for|at)\s+([^?.!]+)(?:[?.!]|$)/i;
				const m = content.match(wxRegex);
				const location = m?.[1]?.trim().replace(/^the\s+/i, "");
				if (location) {
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/weather", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ location }),
						});
						if (resp.ok) {
							const json = await resp.json();
							if (json?.ok) {
								const loc = json.location || {};
								const cur = json.current || {};
								const parts: string[] = [];
								if (typeof cur.temperature === "number") parts.push(`${cur.temperature}°C`);
								if (typeof cur.windspeed === "number") parts.push(`wind ${cur.windspeed} km/h`);
								if (typeof cur.winddirection === "number") parts.push(`dir ${cur.winddirection}°`);
								const summary = parts.length ? parts.join(", ") : "No current details available.";
								const where = [loc.name, loc.country].filter(Boolean).join(", ");
								assistantMsg.content = `Current weather for ${where || location}: ${summary}`;
								assistantMsg.status = "complete";
								set({ conversations: [...getState().conversations] });
								await setDb(CONV_KEY, getState().conversations);
								return;
							}
						}
					} catch {
						// fall back
					}
				}
			}
			
			// ============================================================================
			// SLACK MCP TOOLS
			// ============================================================================
			
			// Slack: List channels
			if (getState().activeTools?.["slack_channels"]) {
				const wantsChannels = /\b(list|show|get|what\s+(?:are|is))\s+.{0,30}?\bchannels?\b/i.test(content) &&
				                     /\bslack\b/i.test(content) ||
				                     /\bslack\s+channels?\b/i.test(content) ||
				                     /\bchannels?\s+(?:in|on|of)\s+(?:my\s+)?slack\b/i.test(content);
				if (wantsChannels) {
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/slack/channels", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({}),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const channels = json.channels || [];
							const publicChannels = channels.filter((ch: any) => !ch.is_private && !ch.is_archived);
							const channelList = publicChannels.map((ch: any) => `#${ch.name}`).join(", ");
							assistantMsg.content = channelList ? `Slack channels: ${channelList}` : "No channels found.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 401) {
							assistantMsg.content = json.message || "Slack not configured. Set SLACK_BOT_TOKEN in .env file.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 403 && json.blocked) {
							assistantMsg.content = json.message || "Slack usage limit exceeded.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {}
				}
			}
			
			// Slack: Search messages
			if (getState().activeTools?.["slack_search"]) {
				// Match: "search for messages containing 'test'" or "list all messages containing 'test'"
				const searchMatch = content.match(/\b(?:search|list|find|show)\s+(?:for\s+)?(?:all\s+)?(?:messages?\s+)?(?:containing|with)\s+['"]([^'"]+)['"]/i) ||
				                   content.match(/\bslack.*search.*['"]([^'"]+)['"]/i) ||
				                   content.match(/\bfind.*messages.*['"]([^'"]+)['"]/i);
				if (searchMatch) {
					const query = searchMatch[1].trim();
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/slack/search", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ query, maxResults: 10 }),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const messages = json.messages || [];
							if (messages.length === 0) {
								assistantMsg.content = `No messages found matching "${query}".`;
							} else {
								const summary = messages.slice(0, 5).map((msg: any) => 
									`- ${msg.text?.substring(0, 100)} (channel: ${msg.channel?.name || 'unknown'})`
								).join("\n");
								assistantMsg.content = `Found ${json.total} messages matching "${query}":\n${summary}${json.total > 5 ? `\n... and ${json.total - 5} more` : ''}`;
							}
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 401) {
							assistantMsg.content = json.message || "Slack not configured.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 403 && json.blocked) {
							assistantMsg.content = json.message || "Slack usage limit exceeded.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {}
				}
			}
			
			// Slack: Latest message in channel
			if (getState().activeTools?.["slack_latest_message"]) {
				// Match without channel: "last message on slack" (check this FIRST)
				const latestGeneralMatch = /\b(?:what(?:'s| is)|show|get|list)\s+(?:the\s+)?(?:latest|last|most\s+recent)\s+message\s+(?:on|in|from)?\s*slack\b/i.test(content);
				// Match with channel: "last message in #general"
				const latestMatch = !latestGeneralMatch && content.match(/\b(?:what(?:'s| is)|show|get|list)\s+(?:the\s+)?(?:latest|last|most\s+recent)\s+message\s+(?:in|from|on)\s+#?([a-zA-Z0-9_-]+)/i);
				
				if (latestGeneralMatch) {
					// No channel specified - get from general channel
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/slack/latest-message", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ channel: "tous-orionproductions" }), // Default to general channel
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							if (!json.found) {
								assistantMsg.content = `No messages found in Slack.`;
							} else {
								const msg = json.message;
								assistantMsg.content = `Latest message on Slack (from #${json.channel}):\nFrom: ${msg.user}\nDate: ${new Date(msg.date).toLocaleString()}\nMessage: ${msg.text}`;
							}
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 401) {
							assistantMsg.content = json.message || "Slack not configured.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 403 && json.blocked) {
							assistantMsg.content = json.message || "Slack usage limit exceeded.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {}
				} else if (latestMatch) {
					const channelName = latestMatch[1];
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/slack/latest-message", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ channel: channelName }),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							if (!json.found) {
								assistantMsg.content = `No messages found in #${json.channel || channelName}.`;
							} else {
								const msg = json.message;
								assistantMsg.content = `Latest message in #${json.channel}:\nFrom: ${msg.user}\nDate: ${new Date(msg.date).toLocaleString()}\nMessage: ${msg.text}`;
							}
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 401) {
							assistantMsg.content = json.message || "Slack not configured.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 403 && json.blocked) {
							assistantMsg.content = json.message || "Slack usage limit exceeded.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {}
				}
			}
			
			// Slack: Count messages from user in channel
			if (getState().activeTools?.["slack_count_from_user"]) {
				const countMatch = content.match(/\b(?:how many|count)\s+messages?\s+(?:did|from)\s+@?([a-zA-Z0-9._-]+)\s+(?:send|sent|post|posted)\s+(?:in|to)\s+#?([a-zA-Z0-9_-]+)/i);
				if (countMatch) {
					const userName = countMatch[1];
					const channelName = countMatch[2];
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/slack/count-from-user", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ user: userName, channel: channelName }),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							assistantMsg.content = `@${json.user} sent ${json.count} message${json.count !== 1 ? 's' : ''} in #${json.channel}.`;
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 401) {
							assistantMsg.content = json.message || "Slack not configured.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 403 && json.blocked) {
							assistantMsg.content = json.message || "Slack usage limit exceeded.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {}
				}
			}
			
			// Slack: Get my mentions
			if (getState().activeTools?.["slack_mentions"]) {
				const mentionsMatch = /\b(?:what are|show|get|list)\s+(?:my\s+)?(?:slack\s+)?(?:unread\s+)?mentions?\b/i.test(content) ||
				                     /\b(?:mentions?\s+(?:in|on)\s+slack)\b/i.test(content);
				if (mentionsMatch) {
					try {
						const resp = await fetch("http://localhost:3001/mcp/tools/slack/mentions", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({}),
						});
						const json = await resp.json();
						if (resp.ok && json?.ok) {
							const mentions = json.mentions || [];
							if (mentions.length === 0) {
								assistantMsg.content = "You have no recent mentions in Slack.";
							} else {
								const summary = mentions.slice(0, 5).map((msg: any) => 
									`- ${msg.text?.substring(0, 100)} (in ${msg.channel?.name || 'unknown'})`
								).join("\n");
								assistantMsg.content = `You have ${json.total} mention${json.total !== 1 ? 's' : ''}:\n${summary}${json.total > 5 ? `\n... and ${json.total - 5} more` : ''}`;
							}
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 401) {
							assistantMsg.content = json.message || "Slack not configured.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						} else if (resp.status === 403 && json.blocked) {
							assistantMsg.content = json.message || "Slack usage limit exceeded.";
							assistantMsg.status = "complete";
							set({ conversations: [...getState().conversations] });
							await setDb(CONV_KEY, getState().conversations);
							return;
						}
					} catch {}
				}
			}
			
			// Add a transient system instruction to reply in the detected language
			const langInstruction = replyLang === "fr" ? "Veuillez répondre en français." : "Please reply in English.";
			const baseHistory = conv.messages.map(m => ({
					role: m.role,
					content: m.content,
				}));
			const historyWithLang = [
				{ role: "system" as const, content: langInstruction },
				...baseHistory,
			];
			for await (const delta of sendWithProvider({
				history: historyWithLang,
				attachments: userMsg.attachments?.map(a => ({ id: a.id, name: a.name, dataUrl: a.dataUrl, type: "image" })),
				settings: state.settings,
			})) {
				assistantMsg.content += delta;
				set({ conversations: [...getState().conversations] });
			}
			assistantMsg.status = "complete";
			set({ conversations: [...getState().conversations] });
		} catch (err) {
			assistantMsg.status = "error";
			assistantMsg.content = (err as Error)?.message || "Error";
			set({ conversations: [...getState().conversations] });
		} finally {
			await setDb(CONV_KEY, getState().conversations);
		}
	},
}));

async function setDb<T>(key: string, value: T): Promise<void> {
	try {
		await set(key, value);
	} catch {
		// fallback
		localStorage.setItem(key, JSON.stringify(value));
	}
}

function detectLang(text: string): "fr" | "en" {
	const t = (text || "").toLowerCase();
	const frenchHints = [" le ", " la ", " les ", " des ", " un ", " une ", " et ", " ou ", " bonjour", "merci", "s'il", "vous", "ça", "été", "était"];
	let score = 0;
	for (const h of frenchHints) if (t.includes(h)) score++;
	if (/[àâäáçéèêëîïôöùûü]/i.test(text || "")) score += 2;
	return score >= 2 ? "fr" : "en";
}

function generateId(): string {
	try {
		// @ts-ignore
		if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
			// @ts-ignore
			return (crypto as any).randomUUID();
		}
	} catch {}
	return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}


