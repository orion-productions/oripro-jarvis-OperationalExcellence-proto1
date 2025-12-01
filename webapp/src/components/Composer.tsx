import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/chatStore";
import { tts } from "../utils/tts";
import { t, type Language } from "../i18n/translations";

export function Composer() {
	const { sendMessage, setUi } = useChatStore();
	const settings = useChatStore(s => s.settings);
	const currentLang = (settings.language || 'en') as Language;
	const micOn = useChatStore(s => s.ui.micOn ?? false);
	const speakerOn = useChatStore(s => s.ui.speakerOn ?? true);
	const [value, setValue] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [images, setImages] = useState<{ id: string; name: string; dataUrl: string }[]>([]);
	const [listening, setListening] = useState(false);
	const recognitionRef = useRef<any>(null);
	const [interim, setInterim] = useState<string>("");
	const micOnRef = useRef<boolean>(micOn);
	useEffect(() => { micOnRef.current = micOn; }, [micOn]);
	const currentRecogLangRef = useRef<string>("en-US");

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		if (!value.trim() && images.length === 0) return;
		try { tts.ensureUnlocked(); } catch {}
		sendMessage(value, images.map(img => ({
			id: img.id,
			type: "image" as const,
			name: img.name,
			dataUrl: img.dataUrl,
		})));
		setValue("");
		setImages([]);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	function stopRecognition() {
		try { recognitionRef.current?.abort?.(); } catch {}
		try { recognitionRef.current?.stop?.(); } catch {}
		recognitionRef.current = null;
		setListening(false);
	}

	function startRecognition(forceLang?: string) {
		const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		if (!SR) {
			alert("Speech Recognition not supported in this browser.");
			setUi({ micOn: false });
			return;
		}
		try { window.speechSynthesis?.cancel(); } catch {}
		stopRecognition();
		const recog = new SR();
		recognitionRef.current = recog;
		recog.continuous = true;
		recog.interimResults = true;
		const langToUse = forceLang || (settings.autoLang ? (settings.speechLang || navigator.language || "en-US") : (settings.speechLang || "en-US"));
		recog.lang = langToUse;
		currentRecogLangRef.current = langToUse;
		// barge-in ASAP when any sound/speech is detected
		recog.onsoundstart = () => { try { tts.cancel(); } catch {} };
		recog.onspeechstart = () => { try { tts.cancel(); } catch {} };
		recog.onresult = (event: any) => {
			// barge-in: stop any ongoing TTS as soon as we detect speech
			try { window.speechSynthesis?.cancel(); } catch {}
			let interimLocal = "";
			let finalText = "";
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const transcript = event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					finalText += (finalText ? " " : "") + transcript.trim();
				} else {
					interimLocal = transcript;
				}
			}
			setInterim(interimLocal);
			// Live language detection on interim to switch STT language mid-session if needed (local only, do not change settings)
			if (settings.autoLang && interimLocal && interimLocal.length >= 6) {
				const det = detectLang(interimLocal);
				const desired = det === "fr" ? "fr-FR" : "en-US";
				const currentLang = currentRecogLangRef.current || langToUse;
				if (!currentLang.toLowerCase().startsWith(det)) {
					// restart recognition quickly with new lang
					stopRecognition();
					if (micOnRef.current) startRecognition(desired);
					return;
				}
			}
			if (finalText) {
				// do not mutate settings.speechLang; STT language is managed locally
				sendMessage(finalText);
			}
		};
		recog.onerror = () => {
			// keep switch state; try restarting after a short delay if still on
			setTimeout(() => {
				if (micOnRef.current) startRecognition();
			}, 500);
		};
		recog.onend = () => {
			setListening(false);
			setInterim("");
			// If switch remains ON, restart for hands-free mode
			if (micOnRef.current) {
				startRecognition();
			}
		};
		setListening(true);
		recog.start();
	}

	// Ensure recognition matches switch state (auto-recover)
	useEffect(() => {
		if (micOn && !listening) {
			startRecognition();
		}
		if (!micOn && listening) {
			stopRecognition();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [micOn]);

	function detectLang(text: string): "fr" | "en" {
		const t = text.toLowerCase();
		const frenchHints = [" le ", " la ", " les ", " des ", " un ", " une ", " et ", " ou ", " bonjour", "merci", "s'il", "vous", "ça", "été", "était"];
		let score = 0;
		for (const h of frenchHints) if (t.includes(h)) score++;
		// accented chars strongly indicate French
		if (/[àâäáçéèêëîïôöùûü]/i.test(text)) score += 2;
		return score >= 2 ? "fr" : "en";
	}

	async function handleFiles(files: FileList | null) {
		if (!files) return;
		const list: { id: string; name: string; dataUrl: string }[] = [];
		for (const f of Array.from(files)) {
			if (!f.type.startsWith("image/")) continue;
			const dataUrl = await fileToDataUrl(f);
			list.push({ id: crypto.randomUUID(), name: f.name, dataUrl });
		}
		setImages(prev => [...prev, ...list]);
	}

	function toggleMic() {
		if (micOnRef.current || listening) {
			setUi({ micOn: false });
			stopRecognition();
		} else {
			setUi({ micOn: true });
			// silently prime TTS to unlock audio pipeline without audible output
			try { tts.prime(settings.speechLang || navigator.language || "en-US"); } catch {}
			startRecognition();
		}
	}

	return (
		<form onSubmit={onSubmit} className="p-3">
			<div className="max-w-3xl mx-auto flex items-end gap-2">
				<button
					type="button"
					onClick={() => setUi({ showSettings: true })}
					className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
					title={t("openSettings", currentLang)}
				>
					⚙️
				</button>
				<button
					type="button"
					onClick={toggleMic}
					className={`rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm ${listening || micOn ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
					title={t("microphoneOnOff", currentLang)}
				>
					{listening || micOn ? t("micOn", currentLang) : t("micOff", currentLang)}
				</button>
				<button
					type="button"
					onClick={() => {
						const next = !speakerOn;
						setUi({ speakerOn: next });
						// On enabling speaker, speak a short phrase immediately (unlocks audio on user gesture)
						if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
							try {
								const u = new SpeechSynthesisUtterance("Ready");
								u.lang = (navigator.language || "en-US");
								window.speechSynthesis.cancel();
								window.speechSynthesis.resume();
								window.speechSynthesis.speak(u);
							} catch {}
						}
					}}
					className={`rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm ${speakerOn ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
					title={t("speakerOnOff", currentLang)}
				>
					{speakerOn ? t("speakerOn", currentLang) : t("speakerOff", currentLang)}
				</button>
				<div className="flex-1">
					<div className="rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2 bg-white dark:bg-neutral-950">
						<textarea
							className="w-full bg-transparent outline-none resize-none leading-6"
							rows={2}
							placeholder={t("message", currentLang)}
							value={value}
							onChange={e => setValue(e.target.value)}
						/>
						{listening && interim && (
							<div className="mt-1 text-xs text-neutral-500">
								{interim}
							</div>
						)}
						{images.length > 0 && (
							<div className="mt-2 flex gap-2 flex-wrap">
								{images.map(img => (
									<div key={img.id} className="relative">
										<img src={img.dataUrl} alt={img.name} className="h-16 w-16 object-cover rounded border border-neutral-200 dark:border-neutral-800" />
										<button
											type="button"
											onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}
											className="absolute -top-2 -right-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-full w-5 h-5 text-xs"
											aria-label={t("removeImage", currentLang)}
										>×</button>
									</div>
								))}
							</div>
						)}
						<div className="flex items-center justify-between mt-2">
							<div className="flex items-center gap-2">
								<label className="cursor-pointer text-sm text-neutral-600 dark:text-neutral-300 hover:underline">
									<input
										ref={fileInputRef}
										type="file"
										accept="image/*"
										multiple
										className="hidden"
										onChange={e => handleFiles(e.target.files)}
									/>
									{t("addImages", currentLang)}
								</label>
							</div>
							<button
								type="submit"
								className="rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
							>
								{t("send", currentLang)}
							</button>
						</div>
					</div>
				</div>
			</div>
		</form>
	);
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const fr = new FileReader();
		fr.onerror = () => reject(fr.error);
		fr.onload = () => resolve(String(fr.result));
		fr.readAsDataURL(file);
	});
}


