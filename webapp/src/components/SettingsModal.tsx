import { useEffect, useState } from "react";
import { useChatStore } from "../store/chatStore";
import { t, type Language } from "../i18n/translations";

export function SettingsModal() {
	const { settings, updateSettings, setUi } = useChatStore();
	const currentLang = (settings.language || 'en') as Language;
	const [local, setLocal] = useState(settings);
	const [testing, setTesting] = useState<"idle" | "running" | "ok" | "fail">("idle");
	const [testMessage, setTestMessage] = useState<string>("");
	const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
	const [ttsError, setTtsError] = useState<string>("");

	function close() {
		setUi({ showSettings: false });
	}

	function save() {
		updateSettings(local);
		close();
	}

	useEffect(() => {
		function loadVoices() {
			if (!("speechSynthesis" in window)) return;
			const v = window.speechSynthesis.getVoices?.() || [];
			setVoices(v);
		}
		loadVoices();
		if ("speechSynthesis" in window) {
			window.speechSynthesis.onvoiceschanged = loadVoices;
		}
		return () => {
			if ("speechSynthesis" in window) {
				window.speechSynthesis.onvoiceschanged = null;
			}
		};
	}, []);

	async function testConnection() {
		setTesting("running");
		setTestMessage("");
		try {
			if (local.provider === "ollama") {
				const base = (local.baseUrl || "http://127.0.0.1:11434").replace(/\/+$/, "");
				const r = await fetch(`${base}/api/tags`);
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				setTesting("ok");
				setTestMessage(t("ollamaReachable", currentLang));
				return;
			}
			if (local.provider === "openai") {
				const base = (local.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
				const url = `${base}/chat/completions`;
				const headers: Record<string, string> = { "Content-Type": "application/json" };
				if (local.apiKey) headers.Authorization = `Bearer ${local.apiKey}`;
				const r = await fetch(url, {
					method: "POST",
					headers,
					body: JSON.stringify({
						model: local.model,
						messages: [{ role: "user", content: "ping" }],
						temperature: 0,
						max_tokens: 5,
						stream: false,
					}),
				});
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				setTesting("ok");
				setTestMessage(t("openaiReachable", currentLang));
				return;
			}
			if (local.provider === "gemini") {
				const base = (local.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
				const url = `${base}/v1beta/models/${encodeURIComponent(local.model)}:generateContent${local.apiKey ? `?key=${encodeURIComponent(local.apiKey)}` : ""}`;
				const r = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }] }),
				});
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				setTesting("ok");
				setTestMessage(t("geminiReachable", currentLang));
				return;
			}
			throw new Error(t("unknownProvider", currentLang));
		} catch (e) {
			setTesting("fail");
			setTestMessage((e as Error)?.message || t("connectionFailed", currentLang));
		}
	}

	function testVoice() {
		setTtsError("");
		try {
			if (!("speechSynthesis" in window)) {
				setTtsError(t("speechSynthesisNotSupported", currentLang));
				return;
			}
			const synth = window.speechSynthesis;
			const utter = new SpeechSynthesisUtterance("Test voice.");
			const vs = synth.getVoices?.() || [];
			if (local.ttsVoice) {
				const v = vs.find(v => v.name === local.ttsVoice);
				if (v) utter.voice = v;
			}
			utter.lang = local.speechLang || (navigator.language || "en-US");
			utter.rate = local.ttsRate ?? 1;
			utter.pitch = local.ttsPitch ?? 1;
			try { synth.cancel(); } catch {}
			try { synth.resume(); } catch {}
			synth.speak(utter);
		} catch (e) {
			setTtsError((e as Error)?.message || t("failedToSpeak", currentLang));
		}
	}

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
			<div className="w-full max-w-lg rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">{t("settings", currentLang)}</h2>
					<button onClick={close} className="text-xl">×</button>
				</div>
				<div className="mt-4 grid grid-cols-1 gap-3">
					<label className="grid gap-1">
						<span className="text-sm text-neutral-500">{t("provider", currentLang)}</span>
						<select
							value={local.provider}
							onChange={e => setLocal(s => ({ ...s, provider: e.target.value as any }))}
							className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5"
						>
							<option value="ollama">{t("ollamaLocal", currentLang)}</option>
							<option value="openai">{t("openai", currentLang)}</option>
							<option value="gemini">{t("gemini", currentLang)}</option>
						</select>
					</label>
					<label className="grid gap-1">
						<span className="text-sm text-neutral-500">{t("model", currentLang)}</span>
						<input
							value={local.model}
							onChange={e => setLocal(s => ({ ...s, model: e.target.value }))}
							className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5"
							placeholder="e.g., llama3.2:latest or gpt-4o-mini"
						/>
					</label>
					{local.provider === "ollama" && (
						<div className="grid gap-1">
							<span className="text-sm text-neutral-500">{t("modelPresets", currentLang)}</span>
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									onClick={() => setLocal(s => ({ ...s, model: "llama3.2:3b" }))}
									className="rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
								>
									llama3.2:3b
								</button>
								<button
									type="button"
									onClick={() => setLocal(s => ({ ...s, model: "moondream:latest" }))}
									className="rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
								>
									moondream:latest
								</button>
								<button
									type="button"
									onClick={() => setLocal(s => ({ ...s, model: "qwen2-vl:latest" }))}
									className="rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
								>
									qwen2-vl:latest
								</button>
								<button
									type="button"
									onClick={() => setLocal(s => ({ ...s, model: "llava:latest" }))}
									className="rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
								>
									llava:latest
								</button>
							</div>
						</div>
					)}
					<label className="grid gap-1">
						<span className="text-sm text-neutral-500">{t("apiBaseUrl", currentLang)}</span>
						<input
							value={local.baseUrl || ""}
							onChange={e => setLocal(s => ({ ...s, baseUrl: e.target.value }))}
							className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5"
							placeholder={t("optionalOverride", currentLang)}
						/>
					</label>
					{local.provider !== "ollama" && (
						<label className="grid gap-1">
							<span className="text-sm text-neutral-500">{t("apiKey", currentLang)}</span>
							<input
								type="password"
								value={local.apiKey || ""}
								onChange={e => setLocal(s => ({ ...s, apiKey: e.target.value }))}
								className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5"
								placeholder={t("pasteYourApiKey", currentLang)}
							/>
						</label>
					)}
					<div className="grid grid-cols-2 gap-3">
						<label className="grid gap-1">
							<span className="text-sm text-neutral-500">{t("temperature", currentLang)}</span>
							<input
								type="number" step="0.1" min="0" max="2"
								value={local.temperature}
								onChange={e => setLocal(s => ({ ...s, temperature: Number(e.target.value) }))}
								className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5"
							/>
						</label>
						<label className="grid gap-1">
							<span className="text-sm text-neutral-500">{t("maxTokens", currentLang)}</span>
							<input
								type="number" min="0"
								value={local.maxTokens || 0}
								onChange={e => setLocal(s => ({ ...s, maxTokens: Number(e.target.value) || undefined }))}
								className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5"
							/>
						</label>
					</div>
					<label className="inline-flex items-center gap-2 mt-2">
						<input
							type="checkbox"
							checked={local.autoTts ?? true}
							onChange={e => setLocal(s => ({ ...s, autoTts: e.target.checked }))}
						/>
						<span className="text-sm">{t("autoSpeakAssistantReplies", currentLang)}</span>
					</label>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
						<label className="grid gap-1 md:col-span-2">
							<span className="text-sm text-neutral-500">{t("voice", currentLang)}</span>
							<select
								value={local.ttsVoice || ""}
								onChange={e => setLocal(s => ({ ...s, ttsVoice: e.target.value || undefined }))}
								className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5"
							>
								<option value="">{t("default", currentLang)}</option>
								{voices.map(v => (
									<option key={v.voiceURI} value={v.name}>
										{v.name} {v.lang ? `(${v.lang})` : ""}
									</option>
								))}
							</select>
						</label>
						<label className="grid gap-1">
							<span className="text-sm text-neutral-500">{t("rate", currentLang)}</span>
							<input
								type="number" step="0.1" min="0.5" max="2"
								value={local.ttsRate ?? 1}
								onChange={e => setLocal(s => ({ ...s, ttsRate: Number(e.target.value) }))}
								className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5"
							/>
						</label>
						<label className="grid gap-1">
							<span className="text-sm text-neutral-500">{t("pitch", currentLang)}</span>
							<input
								type="number" step="0.1" min="0" max="2"
								value={local.ttsPitch ?? 1}
								onChange={e => setLocal(s => ({ ...s, ttsPitch: Number(e.target.value) }))}
								className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5"
							/>
						</label>
					</div>
					<div className="flex items-center gap-2">
						<button onClick={testVoice} className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700">{t("testVoice", currentLang)}</button>
						{ttsError && <span className="text-sm text-red-600">{ttsError}</span>}
					</div>
				</div>
				<div className="mt-4 flex items-center justify-between gap-2">
					<div className="text-sm">
						{testing === "ok" && <span className="text-green-600">✓ {testMessage}</span>}
						{testing === "fail" && <span className="text-red-600">✕ {testMessage}</span>}
					</div>
					<div className="flex gap-2">
						<button
							onClick={testConnection}
							disabled={testing === "running"}
							className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 disabled:opacity-50"
						>
							{testing === "running" ? t("testing", currentLang) : t("testConnection", currentLang)}
						</button>
						<button onClick={close} className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700">{t("cancel", currentLang)}</button>
						<button onClick={save} className="px-3 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">{t("save", currentLang)}</button>
					</div>
				</div>
			</div>
		</div>
	);
}


