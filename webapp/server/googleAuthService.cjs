/**
 * Google OAuth2 Authentication Service
 * Handles OAuth2 flow for Gmail and Calendar APIs
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleAuthService {
	constructor() {
		this.oauth2Client = null;
		this.tokenPath = path.join(__dirname, '.google-tokens.json');
		this.initialize();
	}

	initialize() {
		const clientId = process.env.GOOGLE_CLIENT_ID;
		const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
		const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback';

		if (!clientId || !clientSecret) {
			console.warn('[GoogleAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
			console.warn('[GoogleAuth] Gmail and Calendar features will be disabled');
			return;
		}

		this.oauth2Client = new google.auth.OAuth2(
			clientId,
			clientSecret,
			redirectUri
		);

		// Try to load existing tokens
		this.loadTokens();

		console.log('[GoogleAuth] Initialized');
	}

	/**
	 * Get OAuth2 authorization URL
	 */
	getAuthUrl() {
		if (!this.oauth2Client) {
			throw new Error('OAuth2 client not initialized. Check your .env file.');
		}

		const scopes = [
			'https://www.googleapis.com/auth/gmail.readonly',
			'https://www.googleapis.com/auth/gmail.modify',
			'https://www.googleapis.com/auth/calendar.readonly',
			'https://www.googleapis.com/auth/calendar',
			// 'https://www.googleapis.com/auth/cloud-billing.readonly', // Uncomment for billing API
		];

		return this.oauth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: scopes,
			prompt: 'consent' // Force consent screen to get refresh token
		});
	}

	/**
	 * Exchange authorization code for tokens
	 */
	async getTokens(code) {
		if (!this.oauth2Client) {
			throw new Error('OAuth2 client not initialized');
		}

		const { tokens } = await this.oauth2Client.getToken(code);
		this.oauth2Client.setCredentials(tokens);
		
		// Save tokens to file
		this.saveTokens(tokens);
		
		console.log('[GoogleAuth] Tokens obtained and saved');
		return tokens;
	}

	/**
	 * Get authenticated client
	 */
	getClient() {
		if (!this.oauth2Client) {
			throw new Error('OAuth2 client not initialized');
		}

		if (!this.isAuthenticated()) {
			throw new Error('Not authenticated. Please login first.');
		}

		return this.oauth2Client;
	}

	/**
	 * Check if user is authenticated
	 */
	isAuthenticated() {
		if (!this.oauth2Client) return false;
		
		const credentials = this.oauth2Client.credentials;
		return !!(credentials && (credentials.access_token || credentials.refresh_token));
	}

	/**
	 * Get authentication status
	 */
	getStatus() {
		if (!this.oauth2Client) {
			return {
				available: false,
				authenticated: false,
				reason: 'OAuth2 not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env'
			};
		}

		if (!this.isAuthenticated()) {
			return {
				available: true,
				authenticated: false,
				reason: 'Not authenticated. Please login.'
			};
		}

		const creds = this.oauth2Client.credentials;
		return {
			available: true,
			authenticated: true,
			expiryDate: creds.expiry_date,
			scopes: creds.scope
		};
	}

	/**
	 * Revoke tokens and logout
	 */
	async logout() {
		if (this.oauth2Client && this.isAuthenticated()) {
			try {
				await this.oauth2Client.revokeCredentials();
				console.log('[GoogleAuth] Tokens revoked');
			} catch (error) {
				console.error('[GoogleAuth] Error revoking tokens:', error.message);
			}
		}

		// Clear tokens
		this.oauth2Client.setCredentials({});
		
		// Delete token file
		if (fs.existsSync(this.tokenPath)) {
			fs.unlinkSync(this.tokenPath);
			console.log('[GoogleAuth] Token file deleted');
		}
	}

	/**
	 * Load tokens from file
	 */
	loadTokens() {
		if (!this.oauth2Client) return;

		if (fs.existsSync(this.tokenPath)) {
			try {
				const tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
				this.oauth2Client.setCredentials(tokens);
				console.log('[GoogleAuth] Tokens loaded from file');
			} catch (error) {
				console.error('[GoogleAuth] Error loading tokens:', error.message);
			}
		}
	}

	/**
	 * Save tokens to file (encrypted in production!)
	 */
	saveTokens(tokens) {
		try {
			fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
			// In production, encrypt this file!
			// TODO: Use proper encryption (e.g., crypto module with secret from env)
			console.log('[GoogleAuth] Tokens saved to', this.tokenPath);
		} catch (error) {
			console.error('[GoogleAuth] Error saving tokens:', error.message);
		}
	}

	/**
	 * Auto-refresh tokens when expired
	 */
	async ensureValidTokens() {
		if (!this.oauth2Client || !this.isAuthenticated()) {
			throw new Error('Not authenticated');
		}

		const credentials = this.oauth2Client.credentials;
		const expiryDate = credentials.expiry_date;

		// If token expires in less than 5 minutes, refresh it
		if (expiryDate && expiryDate - Date.now() < 5 * 60 * 1000) {
			console.log('[GoogleAuth] Token expiring soon, refreshing...');
			try {
				const { credentials: newCreds } = await this.oauth2Client.refreshAccessToken();
				this.oauth2Client.setCredentials(newCreds);
				this.saveTokens(newCreds);
				console.log('[GoogleAuth] Tokens refreshed');
			} catch (error) {
				console.error('[GoogleAuth] Error refreshing tokens:', error.message);
				throw error;
			}
		}
	}
}

// Export singleton instance
module.exports = new GoogleAuthService();

