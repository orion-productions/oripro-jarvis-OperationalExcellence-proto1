/**
 * GitHub API Service
 * Handles GitHub API authentication and requests using Octokit
 */

const { Octokit } = require('@octokit/rest');

class GitHubAuthService {
	constructor() {
		this.octokit = null;
		this.owner = null;
		this.authenticated = false;
		this.initialize();
	}

	initialize() {
		const token = process.env.GITHUB_TOKEN;
		const owner = process.env.GITHUB_OWNER || 'orion-productions';

		if (!token) {
			console.warn('[GitHubAuth] Missing GITHUB_TOKEN in .env');
			console.warn('[GitHubAuth] GitHub features will be disabled');
			return;
		}

		this.owner = owner;
		this.octokit = new Octokit({ auth: token });
		this.authenticated = true;

		console.log(`[GitHubAuth] Initialized for organization: ${owner}`);
	}

	isAuthenticated() {
		return this.authenticated;
	}

	getOctokit() {
		return this.octokit;
	}

	getOwner() {
		return this.owner;
	}

	/**
	 * List all repositories for the organization/user
	 */
	async listRepositories(options = {}) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		try {
			const response = await this.octokit.repos.listForOrg({
				org: this.owner,
				type: options.type || 'all', // all, public, private, forks, sources, member
				sort: options.sort || 'updated',
				direction: options.direction || 'desc',
				per_page: options.perPage || 100
			});

			return response.data;
		} catch (error) {
			// If org repos fail, try user repos
			if (error.status === 404) {
				const response = await this.octokit.repos.listForAuthenticatedUser({
					type: options.type || 'all',
					sort: options.sort || 'updated',
					direction: options.direction || 'desc',
					per_page: options.perPage || 100
				});
				return response.data;
			}
			throw error;
		}
	}

	/**
	 * Get repository details
	 */
	async getRepository(repo) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.repos.get({
			owner: this.owner,
			repo: repo
		});

		return response.data;
	}

	/**
	 * List commits in a repository
	 */
	async listCommits(repo, options = {}) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.repos.listCommits({
			owner: this.owner,
			repo: repo,
			per_page: options.perPage || 30,
			sha: options.branch,
			since: options.since,
			until: options.until
		});

		return response.data;
	}

	/**
	 * Get commit details
	 */
	async getCommit(repo, sha) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.repos.getCommit({
			owner: this.owner,
			repo: repo,
			ref: sha
		});

		return response.data;
	}

	/**
	 * Search code across repositories
	 */
	async searchCode(query, options = {}) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const searchQuery = `${query} org:${this.owner}`;

		const response = await this.octokit.search.code({
			q: searchQuery,
			per_page: options.perPage || 30,
			sort: options.sort,
			order: options.order || 'desc'
		});

		return response.data;
	}

	/**
	 * Get file contents from repository
	 */
	async getFileContents(repo, path, ref = 'main') {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.repos.getContent({
			owner: this.owner,
			repo: repo,
			path: path,
			ref: ref
		});

		return response.data;
	}

	/**
	 * List pull requests
	 */
	async listPullRequests(repo, options = {}) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.pulls.list({
			owner: this.owner,
			repo: repo,
			state: options.state || 'open', // open, closed, all
			sort: options.sort || 'created',
			direction: options.direction || 'desc',
			per_page: options.perPage || 30
		});

		return response.data;
	}

	/**
	 * Get pull request details
	 */
	async getPullRequest(repo, pullNumber) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.pulls.get({
			owner: this.owner,
			repo: repo,
			pull_number: pullNumber
		});

		return response.data;
	}

	/**
	 * List issues
	 */
	async listIssues(repo, options = {}) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.issues.listForRepo({
			owner: this.owner,
			repo: repo,
			state: options.state || 'open', // open, closed, all
			sort: options.sort || 'created',
			direction: options.direction || 'desc',
			per_page: options.perPage || 30
		});

		return response.data;
	}

	/**
	 * Get issue details
	 */
	async getIssue(repo, issueNumber) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.issues.get({
			owner: this.owner,
			repo: repo,
			issue_number: issueNumber
		});

		return response.data;
	}

	/**
	 * List branches
	 */
	async listBranches(repo) {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.repos.listBranches({
			owner: this.owner,
			repo: repo,
			per_page: 100
		});

		return response.data;
	}

	/**
	 * Get organization details
	 */
	async getOrganization() {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		try {
			const response = await this.octokit.orgs.get({
				org: this.owner
			});
			return response.data;
		} catch (error) {
			// If not an org, return user info
			const response = await this.octokit.users.getAuthenticated();
			return response.data;
		}
	}

	/**
	 * Get rate limit status
	 */
	async getRateLimit() {
		if (!this.isAuthenticated()) {
			throw new Error('GitHub not authenticated');
		}

		const response = await this.octokit.rateLimit.get();
		return response.data;
	}

	/**
	 * Helper: Find repository by name (fuzzy match)
	 */
	async findRepositoryByName(repoName) {
		const repos = await this.listRepositories();
		
		// Exact match
		let repo = repos.find(r => r.name.toLowerCase() === repoName.toLowerCase());
		
		// Partial match if no exact match
		if (!repo) {
			repo = repos.find(r => r.name.toLowerCase().includes(repoName.toLowerCase()));
		}

		if (!repo) {
			throw new Error(`Repository not found: ${repoName}`);
		}

		return repo;
	}
}

module.exports = new GitHubAuthService();

