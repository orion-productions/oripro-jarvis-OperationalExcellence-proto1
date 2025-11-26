export type SpeakOptions = {
	voiceName?: string;
	lang?: string;
	rate?: number;
	pitch?: number;
	volume?: number;
};

function chunkText(text: string, maxLen = 220): string[] {
	const parts: string[] = [];
	let buf = "";
	const sentences = text.split(/(?<=[\.\!\?\u2026])\s+/);
	for (const s of sentences) {
		if (!s) continue;
		if ((buf + " " + s).trim().length <= maxLen) {
			buf = (buf ? buf + " " : "") + s;
		} else {
			if (buf) parts.push(buf);
			if (s.length <= maxLen) {
				buf = s;
			} else {
				// hard wrap long segment
				let i = 0;
				while (i < s.length) {
					parts.push(s.slice(i, i + maxLen));
					i += maxLen;
				}
				buf = "";
			}
		}
	}
	if (buf) parts.push(buf);
	return parts;
}

class TTSManager {
	private unlocked = false;
	private unlockingBound = false;
	private speaking = false;
	private currentUtterances: SpeechSynthesisUtterance[] = [];

	get isSpeaking(): boolean {
		return this.speaking;
	}

	ensureUnlocked(): void {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		if (this.unlocked) return;
		if (!this.unlockingBound) {
			this.unlockingBound = true;
			const handler = () => {
				try { window.speechSynthesis.resume(); } catch {}
				this.unlocked = true;
				window.removeEventListener("click", handler);
				window.removeEventListener("keydown", handler);
				window.removeEventListener("touchstart", handler);
			};
			window.addEventListener("click", handler);
			window.addEventListener("keydown", handler);
			window.addEventListener("touchstart", handler);
		}
	}

	private async waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
		let voices = window.speechSynthesis.getVoices?.() || [];
		if (voices.length) return voices;
		await new Promise<void>((resolve) => {
			const start = Date.now();
			const poll = () => {
				voices = window.speechSynthesis.getVoices?.() || [];
				if (voices.length || Date.now() - start > timeoutMs) return resolve();
				setTimeout(poll, 100);
			};
			poll();
		});
		return voices;
	}

	cancel(): void {
		try { window.speechSynthesis.cancel(); } catch {}
		this.speaking = false;
		this.currentUtterances = [];
	}

	prime(lang?: string): void {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		this.ensureUnlocked();
		try {
			const u = new SpeechSynthesisUtterance(" ");
			u.lang = lang || (navigator.language || "en-US");
			u.volume = 0; // silent prime
			window.speechSynthesis.resume();
			window.speechSynthesis.speak(u);
		} catch {}
	}

	async speak(text: string, opts: SpeakOptions = {}): Promise<void> {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		this.ensureUnlocked();
		const voices = await this.waitForVoices();
		this.cancel(); // cancel any ongoing before starting new
		this.speaking = true;
		const chunks = chunkText(text);
		const lang = opts.lang || (navigator.language || "en-US");
		const rate = opts.rate ?? 1;
		const pitch = opts.pitch ?? 1;
		const volume = opts.volume ?? 1;
		let voice: SpeechSynthesisVoice | undefined;
		if (opts.voiceName) {
			voice = voices.find(v => v.name === opts.voiceName);
		}
		if (!voice) {
			voice = voices.find(v => v.lang?.toLowerCase() === lang.toLowerCase())
				|| voices.find(v => v.lang?.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()));
		}

		for (const chunk of chunks) {
			if (!this.speaking) break;
			await new Promise<void>((resolve) => {
				const u = new SpeechSynthesisUtterance(chunk);
				u.lang = lang;
				if (voice) u.voice = voice;
				u.rate = rate;
				u.pitch = pitch;
				u.volume = volume;
				u.onend = () => resolve();
				u.onerror = () => resolve();
				this.currentUtterances.push(u);
				try { window.speechSynthesis.resume(); } catch {}
				window.speechSynthesis.speak(u);
			});
		}
		this.speaking = false;
		this.currentUtterances = [];
	}
}

export const tts = new TTSManager();


