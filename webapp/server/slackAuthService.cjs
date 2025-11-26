/**
 * Slack Authentication Service
 * Handles Slack API authentication and requests
 */

class SlackAuthService {
	constructor() {
		this.token = null;
		this.workspaceInfo = null;
		this.initialize();
	}

	initialize() {
		this.token = process.env.SLACK_BOT_TOKEN || process.env.SLACK_USER_TOKEN;

		if (!this.token) {
			console.warn('[SlackAuth] Missing SLACK_BOT_TOKEN or SLACK_USER_TOKEN in .env');
			console.warn('[SlackAuth] Slack features will be disabled');
			return;
		}

		console.log('[SlackAuth] Initialized with token type:', this.token.startsWith('xoxb') ? 'Bot' : 'User');
	}

	isAuthenticated() {
		return !!this.token;
	}

	getToken() {
		return this.token;
	}

	/**
	 * Make authenticated API call to Slack
	 */
	async callSlackAPI(method, params = {}) {
		if (!this.isAuthenticated()) {
			throw new Error('Slack not authenticated');
		}

		const url = new URL(`https://slack.com/api/${method}`);
		
		// For GET requests, add params to URL
		if (Object.keys(params).length > 0) {
			Object.keys(params).forEach(key => {
				if (params[key] !== undefined && params[key] !== null) {
					url.searchParams.append(key, params[key]);
				}
			});
		}

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${this.token}`,
				'Content-Type': 'application/json; charset=utf-8'
			}
		});

		if (!response.ok) {
			throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.ok) {
			console.error('[Slack API Error] Full response:', JSON.stringify(data, null, 2));
			throw new Error(`Slack API error: ${data.error || 'Unknown error'}${data.needed ? ` (needed: ${data.needed}, provided: ${data.provided})` : ''}`);
		}

		return data;
	}

	/**
	 * Search for messages
	 */
	async searchMessages(query, options = {}) {
		const params = {
			query,
			sort: options.sort || 'timestamp',
			sort_dir: options.sortDir || 'desc',
			count: options.count || 20
		};

		return this.callSlackAPI('search.messages', params);
	}

	/**
	 * List all channels
	 */
	async listChannels(options = {}) {
		const params = {
			exclude_archived: options.excludeArchived !== false,
			limit: options.limit || 200,
			types: options.types || 'public_channel'  // Only public channels (no groups:read scope needed)
		};

		return this.callSlackAPI('conversations.list', params);
	}

	/**
	 * Get channel info
	 */
	async getChannelInfo(channelId) {
		return this.callSlackAPI('conversations.info', { channel: channelId });
	}

	/**
	 * Get messages from a channel
	 */
	async getChannelHistory(channelId, options = {}) {
		const params = {
			channel: channelId,
			limit: options.limit || 100,
			oldest: options.oldest,
			latest: options.latest
		};

		return this.callSlackAPI('conversations.history', params);
	}

	/**
	 * Get user info
	 */
	async getUserInfo(userId) {
		return this.callSlackAPI('users.info', { user: userId });
	}

	/**
	 * List all users
	 */
	async listUsers() {
		return this.callSlackAPI('users.list', { limit: 200 });
	}

	/**
	 * Get workspace info
	 */
	async getWorkspaceInfo() {
		if (this.workspaceInfo) {
			return this.workspaceInfo;
		}

		const authTest = await this.callSlackAPI('auth.test');
		this.workspaceInfo = {
			team: authTest.team,
			team_id: authTest.team_id,
			user: authTest.user,
			user_id: authTest.user_id
		};

		return this.workspaceInfo;
	}

	/**
	 * Helper: Find channel by name
	 */
	async findChannelByName(channelName) {
		// Remove # prefix if present
		const cleanName = channelName.replace(/^#/, '');
		
		const result = await this.listChannels();
		const channel = result.channels.find(ch => 
			ch.name.toLowerCase() === cleanName.toLowerCase()
		);

		if (!channel) {
			throw new Error(`Channel not found: ${channelName}`);
		}

		return channel;
	}

	/**
	 * Helper: Find user by name or display name
	 */
	async findUserByName(userName) {
		// Remove @ prefix if present
		const cleanName = userName.replace(/^@/, '');
		
		const result = await this.listUsers();
		const user = result.members.find(u => 
			u.name.toLowerCase() === cleanName.toLowerCase() ||
			u.profile?.display_name?.toLowerCase() === cleanName.toLowerCase() ||
			u.profile?.real_name?.toLowerCase() === cleanName.toLowerCase()
		);

		if (!user) {
			throw new Error(`User not found: ${userName}`);
		}

		return user;
	}
}

module.exports = new SlackAuthService();

