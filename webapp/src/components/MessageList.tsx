import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStore } from "../store/chatStore";
import { tts } from "../utils/tts";

export function MessageList() {
	const activeConversation = useChatStore(s => s.conversations.find(c => c.id === s.activeConversationId));
	const speakerOn = useChatStore(s => s.ui.speakerOn ?? true);
	const ttsVoice = useChatStore(s => s.settings.ttsVoice);
	const speechLang = useChatStore(s => s.settings.speechLang);
	const ttsRate = useChatStore(s => s.settings.ttsRate ?? 1);
	const ttsPitch = useChatStore(s => s.settings.ttsPitch ?? 1);
	const containerRef = useRef<HTMLDivElement>(null);
	const lastSpokenIdRef = useRef<string | null>(null);
	const ttsUnlockedRef = useRef<boolean>(false);
	const voicesPrimedRef = useRef<boolean>(false);
	const canceledAtRef = useRef<number>(0);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [activeConversation?.messages.length]);

	// Try to unlock speech synthesis after a user gesture (required by some browsers)
	useEffect(() => {
		if (!("speechSynthesis" in window)) return;
		if (ttsUnlockedRef.current) return;
		const tryUnlock = () => {
			try {
				window.speechSynthesis.resume();
				ttsUnlockedRef.current = true;
			} catch {}
			window.removeEventListener("click", tryUnlock);
			window.removeEventListener("keydown", tryUnlock);
			window.removeEventListener("touchstart", tryUnlock);
		};
		window.addEventListener("click", tryUnlock);
		window.addEventListener("keydown", tryUnlock);
		window.addEventListener("touchstart", tryUnlock);
		return () => {
			window.removeEventListener("click", tryUnlock);
			window.removeEventListener("keydown", tryUnlock);
			window.removeEventListener("touchstart", tryUnlock);
		};
	}, []);

	// Prime voices list by polling briefly on mount (some browsers delay populate)
	useEffect(() => {
		if (!("speechSynthesis" in window)) return;
		if (voicesPrimedRef.current) return;
		let tries = 0;
		const timer = setInterval(() => {
			tries++;
			const vs = window.speechSynthesis.getVoices?.() || [];
			if (vs.length || tries > 10) {
				clearInterval(timer);
				voicesPrimedRef.current = true;
			}
		}, 300);
		return () => clearInterval(timer);
	}, []);

	// no-op; TTS always uses selected language

	async function speak(text: string) {
		// Always use selected language; default en-US
		const lang = speechLang || "en-US";
		await tts.speak(text, { voiceName: ttsVoice, lang, rate: ttsRate, pitch: ttsPitch, volume: 1 });
	}

	// Auto speak latest assistant message when completed
	useEffect(() => {
		if (!speakerOn) return;
		const msgs = activeConversation?.messages || [];
		for (let i = msgs.length - 1; i >= 0; i--) {
			const m = msgs[i];
			if (m.role === "assistant" && m.status === "complete" && m.content.trim()) {
				if (lastSpokenIdRef.current !== m.id) {
					lastSpokenIdRef.current = m.id;
					const delay = Date.now() - canceledAtRef.current < 200 ? 200 : 0;
					if (delay) {
						setTimeout(() => void speak(m.content), delay);
					} else {
						void speak(m.content);
					}
				}
				break;
			}
		}
	}, [speakerOn, ttsVoice, ttsRate, ttsPitch, activeConversation?.messages]);

	// If a new assistant response starts streaming, cancel any current TTS (no overlap)
	useEffect(() => {
		const msgs = activeConversation?.messages || [];
		const last = msgs[msgs.length - 1];
		if (last?.role === "assistant" && last?.status === "streaming") {
			try { tts.cancel(); } catch {}
			canceledAtRef.current = Date.now();
		}
	}, [activeConversation?.messages]);
	if (!activeConversation) {
		return <div className="p-6 text-neutral-500">Create a new chat to get started.</div>;
	}

	return (
		<div ref={containerRef} className="h-full overflow-y-auto">
			<div className="max-w-3xl mx-auto p-4 space-y-6">
				{activeConversation.messages.map((m) => (
					<div key={m.id} className="flex gap-3">
						<div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-semibold">
							{m.role === "assistant" ? "AI" : "You"}
						</div>
						<div className="prose prose-neutral dark:prose-invert max-w-none">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{m.content}
							</ReactMarkdown>
							{m.attachments?.length ? (
								<div className="mt-2 grid grid-cols-2 gap-2">
									{m.attachments.map((att) => (
										att.type === "image" ? (
											<img key={att.id} src={att.dataUrl} alt={att.name} className="rounded border border-neutral-200 dark:border-neutral-800" />
										) : null
									))}
								</div>
							) : null}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}


