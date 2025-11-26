export type Provider = "ollama" | "openai" | "gemini";

export type ChatHistoryItem = {
	role: "user" | "assistant" | "system";
	content: string;
};

export type AttachmentInput = {
	id: string;
	type: "image";
	name: string;
	dataUrl: string;
};

export type SendArgs = {
	history: ChatHistoryItem[];
	attachments?: AttachmentInput[];
	settings: {
		provider: Provider;
		model: string;
		apiKey?: string;
		baseUrl?: string;
		temperature: number;
		maxTokens?: number;
	};
};

export async function* sendWithProvider(args: SendArgs): AsyncGenerator<string> {
	switch (args.settings.provider) {
		case "ollama":
			yield* sendOllama(args);
			break;
		case "openai":
			yield* sendOpenAI(args);
			break;
		case "gemini":
			yield* sendGemini(args);
			break;
		default:
			throw new Error("Unknown provider");
	}
}

async function* sendOllama(args: SendArgs): AsyncGenerator<string> {
	const baseUrl = args.settings.baseUrl || "http://localhost:11434";
	const url = `${baseUrl.replace(/\/+$/, "")}/api/chat`;
	const images = (args.attachments || []).map(a => (a.dataUrl.split(",")[1] || ""));
	const resp = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: args.settings.model,
			messages: args.history.map(h => ({
				role: h.role,
				content: h.content,
				images: h.role === "user" && images.length ? images : undefined,
			})),
			stream: true,
			options: {
				temperature: args.settings.temperature,
				num_predict: args.settings.maxTokens,
			},
		}),
	});
	if (!resp.ok || !resp.body) throw new Error(`Ollama error: ${resp.status}`);
	const reader = resp.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let idx;
		while ((idx = buffer.indexOf("\n")) >= 0) {
			const line = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 1);
			if (!line) continue;
			try {
				const json = JSON.parse(line);
				if (json.message?.content) yield json.message.content as string;
			} catch {
				// ignore
			}
		}
	}
}

async function* sendOpenAI(args: SendArgs): AsyncGenerator<string> {
	const baseUrl = args.settings.baseUrl || "https://api.openai.com/v1";
	const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (args.settings.apiKey) headers.Authorization = `Bearer ${args.settings.apiKey}`;
	const contentParts: any[] = [];
	let user: ChatHistoryItem | undefined;
	for (let i = args.history.length - 1; i >= 0; i--) {
		if (args.history[i].role === "user") { user = args.history[i]; break; }
	}
	if (user) {
		contentParts.push({ type: "text", text: user.content });
	}
	for (const img of args.attachments || []) {
		contentParts.push({ type: "image_url", image_url: { url: img.dataUrl } });
	}
	const messages = args.history.map(h => {
		if (h.role === "user" && contentParts.length > 0) {
			return { role: "user", content: contentParts };
		}
		return { role: h.role, content: h.content };
	});
	const resp = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify({
			model: args.settings.model,
			messages,
			temperature: args.settings.temperature,
			max_tokens: args.settings.maxTokens,
			stream: true,
		}),
	});
	if (!resp.ok || !resp.body) throw new Error(`OpenAI error: ${resp.status}`);
	for await (const chunk of iterateSse(resp.body)) {
		if (chunk === "[DONE]") break;
		try {
			const json = JSON.parse(chunk);
			const delta = json.choices?.[0]?.delta?.content;
			if (typeof delta === "string") yield delta;
		} catch {
			// ignore
		}
	}
}

async function* sendGemini(args: SendArgs): AsyncGenerator<string> {
	const model = args.settings.model || "gemini-1.5-flash";
	const baseUrl = args.settings.baseUrl || "https://generativelanguage.googleapis.com";
	const url = `${baseUrl.replace(/\/+$/, "")}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(args.settings.apiKey || "")}`;
	const parts: any[] = [];
	for (const h of args.history) {
		if (h.role === "user") {
			parts.push({ text: h.content });
		} else if (h.role === "assistant") {
			// Gemini doesn't need assistant history for basic prompt; skip or include as context
			parts.push({ text: `Assistant: ${h.content}` });
		}
	}
	for (const img of args.attachments || []) {
		const data = img.dataUrl.split(",")[1] || "";
		const mime = (img.dataUrl.split(";")[0] || "").replace("data:", "") || "image/png";
		parts.push({
			inline_data: {
				data,
				mime_type: mime,
			},
		});
	}
	const resp = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ contents: [{ role: "user", parts }] }),
	});
	if (!resp.ok || !resp.body) throw new Error(`Gemini error: ${resp.status}`);
	for await (const chunk of iterateSse(resp.body)) {
		try {
			const json = JSON.parse(chunk);
			const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
			if (typeof text === "string") yield text;
		} catch {
			// ignore
		}
	}
}

export async function* iterateSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let idx;
		while ((idx = buffer.indexOf("\n")) >= 0) {
			const line = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 1);
			if (!line || !line.startsWith("data:")) continue;
			yield line.slice(5).trim();
		}
	}
}


