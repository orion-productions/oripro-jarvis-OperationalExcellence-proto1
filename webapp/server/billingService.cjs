/**
 * Billing & Rate Limit Protection Service
 * 
 * IMPORTANT DISTINCTION:
 * =====================
 * 1. GOOGLE SERVICES (Gmail, Calendar) - PAID SERVICES
 *    - Can charge your credit card if you exceed free tier
 *    - Requires billing protection to prevent unexpected charges
 *    - Monthly cost limits enforced (default: $0)
 * 
 * 2. FREE SERVICES (Slack, Jira) - NO BILLING
 *    - 100% FREE - no credit card required
 *    - Only have rate limits (requests per minute/day)
 *    - Rate limit tracking only (no actual billing/costs)
 *    - Will never charge you money
 */

class BillingProtectionService {
	constructor() {
		// Safety thresholds - configurable via environment
		this.limits = {
			// ============================================================
			// GOOGLE SERVICES - PAID (can charge credit card)
			// ============================================================
			gmail: {
				dailyQuota: parseInt(process.env.GMAIL_DAILY_QUOTA || '1000000000'), // 1 billion units/day (free tier)
				warningThreshold: parseFloat(process.env.GMAIL_WARNING_THRESHOLD || '0.8'),
				hardLimit: parseFloat(process.env.GMAIL_HARD_LIMIT || '0.95')
			},
			calendar: {
				dailyQuota: parseInt(process.env.CALENDAR_DAILY_QUOTA || '1000000'), // 1 million queries/day (free tier)
				warningThreshold: parseFloat(process.env.CALENDAR_WARNING_THRESHOLD || '0.8'),
				hardLimit: parseFloat(process.env.CALENDAR_HARD_LIMIT || '0.95')
			},
			
			// ============================================================
			// FREE SERVICES - NO BILLING (rate limits only)
			// ============================================================
			slack: {
				// Slack is 100% FREE - no billing, just rate limits
				// Tier 1=1/min, Tier 2=20/min, Tier 3=50/min, Tier 4=100/min
				dailyQuota: parseInt(process.env.SLACK_DAILY_QUOTA || '10000'), // Conservative: 10k requests/day
				warningThreshold: parseFloat(process.env.SLACK_WARNING_THRESHOLD || '0.8'),
				hardLimit: parseFloat(process.env.SLACK_HARD_LIMIT || '0.95')
			},
			// Note: Jira is also FREE (not tracked here yet)
			
			// ============================================================
			// BILLING LIMITS (GOOGLE ONLY)
			// ============================================================
			monthlyCostLimit: parseFloat(process.env.MONTHLY_COST_LIMIT || '0.00'), // $0 = block all paid Google requests
			warningCostThreshold: parseFloat(process.env.WARNING_COST_THRESHOLD || '0.00'),
			
			// Per-request rate limits
			maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100'),
			maxRequestsPerHour: parseInt(process.env.MAX_REQUESTS_PER_HOUR || '1000')
		};
		
		// Usage tracking (in-memory, resets on server restart)
		this.usage = {
			gmail: { today: 0, resetTime: new Date() },
			calendar: { today: 0, resetTime: new Date() },
			slack: { today: 0, resetTime: new Date() },
			costs: { thisMonth: 0, lastUpdate: null },
			rateLimit: { minute: [], hour: [] }
		};

		console.log('[BillingService] Initialized with limits:');
		console.log('  GOOGLE (PAID) - Billing protection active:');
		console.log(`    Gmail: ${this.limits.gmail.dailyQuota.toLocaleString()} units/day`);
		console.log(`    Calendar: ${this.limits.calendar.dailyQuota.toLocaleString()} queries/day`);
		console.log(`    Monthly cost limit: $${this.limits.monthlyCostLimit}`);
		console.log('  FREE SERVICES - Rate limit tracking only (no billing):');
		console.log(`    Slack: ${this.limits.slack.dailyQuota.toLocaleString()} requests/day`);
		console.log(`  Rate limits: ${this.limits.maxRequestsPerMinute}/min, ${this.limits.maxRequestsPerHour}/hour`);
	}

	/**
	 * Main method: Check all limits before allowing API request
	 * @param {string} service - 'gmail' or 'calendar'
	 * @param {string} operation - 'list', 'get', 'send', etc.
	 * @returns {Object} { allowed: boolean, reason?: string, message?: string, warning?: string }
	 */
	async checkAndUpdateUsage(service, operation = 'read') {
		// 1. Check rate limits first (fastest check)
		if (!this.checkRateLimit()) {
			return {
				allowed: false,
				reason: 'rate_limit',
				message: '⏱️ Rate limit exceeded. Too many requests in a short time. Please wait a moment and try again.'
			};
		}

		// 2. Check daily quota usage
		const quotaCheck = this.checkQuota(service, operation);
		if (!quotaCheck.allowed) {
			return quotaCheck;
		}

		// 3. Check billing costs (if available)
		const billingCheck = await this.checkBilling();
		if (!billingCheck.allowed) {
			return billingCheck;
		}

		// 4. All checks passed - increment usage and return
		this.incrementUsage(service, operation);
		
		return {
			allowed: true,
			warning: quotaCheck.warning || billingCheck.warning,
			usage: this.getCurrentUsage()
		};
	}

	/**
	 * Check if service is within daily quota limits
	 */
	checkQuota(service, operation) {
		const limit = this.limits[service];
		if (!limit) {
			console.warn(`[BillingService] Unknown service: ${service}`);
			return { allowed: true };
		}

		// Reset if new day
		this.resetIfNewDay(service);

		// Calculate quota cost for this operation
		const quotaCost = this.getQuotaCost(service, operation);
		const projectedUsage = this.usage[service].today + quotaCost;
		const percentUsed = projectedUsage / limit.dailyQuota;

		// Hard limit check
		if (percentUsed >= limit.hardLimit) {
			const resetTime = new Date(this.usage[service].resetTime);
			resetTime.setDate(resetTime.getDate() + 1);
			resetTime.setHours(0, 0, 0, 0);

			return {
				allowed: false,
				reason: 'quota_exceeded',
				message: `❌ Over usage limit for ${service}. Daily quota: ${Math.round(percentUsed * 100)}% used (${projectedUsage.toLocaleString()}/${limit.dailyQuota.toLocaleString()} units). Request blocked to avoid charges. Quota resets at ${resetTime.toLocaleTimeString()}.`,
				usage: { 
					used: this.usage[service].today, 
					projected: projectedUsage,
					limit: limit.dailyQuota, 
					percent: percentUsed * 100,
					resetTime: resetTime.toISOString()
				}
			};
		}

		// Warning threshold check
		if (percentUsed >= limit.warningThreshold) {
			return {
				allowed: true,
				warning: `⚠️ ${service} usage at ${Math.round(percentUsed * 100)}% (${projectedUsage.toLocaleString()}/${limit.dailyQuota.toLocaleString()} units)`,
				usage: { 
					used: this.usage[service].today, 
					projected: projectedUsage,
					limit: limit.dailyQuota, 
					percent: percentUsed * 100 
				}
			};
		}

		return { allowed: true };
	}

	/**
	 * Check billing costs (placeholder for Cloud Billing API)
	 */
	async checkBilling() {
		try {
			// For now, we'll track that we're in free tier
			// TODO: Implement actual Cloud Billing API call
			const costs = await this.getCurrentMonthCosts();
			
			this.usage.costs.thisMonth = costs;
			this.usage.costs.lastUpdate = Date.now();

			if (costs > this.limits.monthlyCostLimit) {
				return {
					allowed: false,
					reason: 'cost_limit',
					message: `❌ Monthly cost limit exceeded: $${costs.toFixed(2)}/$${this.limits.monthlyCostLimit.toFixed(2)}. All paid operations are blocked to prevent billing. Please check your Google Cloud Console or increase the limit in .env`,
					costs: { current: costs, limit: this.limits.monthlyCostLimit }
				};
			}

			if (costs >= this.limits.warningCostThreshold && this.limits.warningCostThreshold > 0) {
				return {
					allowed: true,
					warning: `⚠️ Monthly costs: $${costs.toFixed(2)} (limit: $${this.limits.monthlyCostLimit.toFixed(2)})`,
					costs: { current: costs, limit: this.limits.monthlyCostLimit }
				};
			}

			return { allowed: true, costs: { current: costs } };
		} catch (error) {
			console.error('[BillingService] Billing check failed:', error.message);
			// For safety, we continue if billing check fails (assume free tier)
			// Change to 'allowed: false' for strict mode
			return { 
				allowed: true,
				warning: '⚠️ Unable to verify billing status'
			};
		}
	}

	/**
	 * Check rate limiting (requests per minute/hour)
	 */
	checkRateLimit() {
		const now = Date.now();
		
		// Clean old timestamps
		this.usage.rateLimit.minute = this.usage.rateLimit.minute.filter(t => now - t < 60000);
		this.usage.rateLimit.hour = this.usage.rateLimit.hour.filter(t => now - t < 3600000);
		
		// Check limits
		if (this.usage.rateLimit.minute.length >= this.limits.maxRequestsPerMinute) {
			console.warn(`[BillingService] Rate limit exceeded: ${this.usage.rateLimit.minute.length}/${this.limits.maxRequestsPerMinute} per minute`);
			return false;
		}
		if (this.usage.rateLimit.hour.length >= this.limits.maxRequestsPerHour) {
			console.warn(`[BillingService] Rate limit exceeded: ${this.usage.rateLimit.hour.length}/${this.limits.maxRequestsPerHour} per hour`);
			return false;
		}
		
		// Add current timestamp
		this.usage.rateLimit.minute.push(now);
		this.usage.rateLimit.hour.push(now);
		
		return true;
	}

	/**
	 * Increment usage counter for a service
	 */
	incrementUsage(service, operation) {
		this.resetIfNewDay(service);
		
		const cost = this.getQuotaCost(service, operation);
		this.usage[service].today += cost;
		
		console.log(`[BillingService] ${service}.${operation}: +${cost} units (total: ${this.usage[service].today})`);
	}

	/**
	 * Get quota cost for an operation
	 * Based on Google's official quota costs
	 */
	getQuotaCost(service, operation) {
		const quotaCosts = {
			gmail: {
				list: 5,        // Listing messages
				get: 5,         // Getting message details
				search: 5,      // Search query
				send: 100,      // Sending email
				modify: 5,      // Modify labels
				delete: 10      // Delete message
			},
			calendar: {
				list: 1,        // List events
				get: 1,         // Get event
				insert: 50,     // Create event
				update: 50,     // Update event
				delete: 50      // Delete event
			},
			slack: {
				// Slack API tier costs (rate limit tiers)
				search: 1,      // Tier 1: 1/min (most expensive)
				list: 1,        // Tier 2-3: 20-50/min
				get: 1,         // Tier 3: 50/min
				history: 1,     // Tier 3: 50/min
				send: 1         // Tier 2: 20/min
			}
		};
		
		return quotaCosts[service]?.[operation] || 1;
	}

	/**
	 * Reset usage if it's a new day
	 */
	resetIfNewDay(service) {
		const now = new Date();
		const resetTime = this.usage[service].resetTime;
		
		if (now.toDateString() !== resetTime.toDateString()) {
			console.log(`[BillingService] New day detected for ${service}, resetting quota`);
			this.usage[service].today = 0;
			this.usage[service].resetTime = now;
		}
	}

	/**
	 * Get current month costs
	 * TODO: Integrate with Cloud Billing API
	 */
	async getCurrentMonthCosts() {
		// For now, assume free tier (return 0)
		// In production, this would call:
		// const billing = google.cloudbilling('v1');
		// const response = await billing.projects.getBillingInfo(...)
		
		const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
		if (!projectId) {
			// No project ID = assuming free tier
			return 0.00;
		}

		// TODO: Implement actual Cloud Billing API call
		// For now, return 0 (free tier)
		return 0.00;
	}

	/**
	 * Get current usage statistics for all services
	 */
	getCurrentUsage() {
		return {
			gmail: {
				used: this.usage.gmail.today,
				limit: this.limits.gmail.dailyQuota,
				percent: (this.usage.gmail.today / this.limits.gmail.dailyQuota) * 100,
				resetTime: this.getNextResetTime().toISOString()
			},
			calendar: {
				used: this.usage.calendar.today,
				limit: this.limits.calendar.dailyQuota,
				percent: (this.usage.calendar.today / this.limits.calendar.dailyQuota) * 100,
				resetTime: this.getNextResetTime().toISOString()
			},
			slack: {
				used: this.usage.slack.today,
				limit: this.limits.slack.dailyQuota,
				percent: (this.usage.slack.today / this.limits.slack.dailyQuota) * 100,
				resetTime: this.getNextResetTime().toISOString()
			},
			costs: {
				thisMonth: this.usage.costs.thisMonth,
				limit: this.limits.monthlyCostLimit,
				lastUpdate: this.usage.costs.lastUpdate
			},
			rateLimit: {
				minute: {
					used: this.usage.rateLimit.minute.length,
					limit: this.limits.maxRequestsPerMinute
				},
				hour: {
					used: this.usage.rateLimit.hour.length,
					limit: this.limits.maxRequestsPerHour
				}
			}
		};
	}

	/**
	 * Get the next quota reset time (midnight)
	 */
	getNextResetTime() {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);
		return tomorrow;
	}

	/**
	 * Manually update cost (for testing or external billing integration)
	 */
	updateCosts(amount) {
		this.usage.costs.thisMonth = amount;
		this.usage.costs.lastUpdate = Date.now();
		console.log(`[BillingService] Costs updated: $${amount}`);
	}
}

// Export singleton instance
module.exports = new BillingProtectionService();

