// Minimal local proxy for OpenAI and Gemini with streaming pass-through.
// Reads keys from .env, handles CORS for http://localhost:5173

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors({
	origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
	methods: ["GET", "POST", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

app.get("/health", (req, res) => {
	res.json({ ok: true, openai: !!OPENAI_API_KEY, gemini: !!GEMINI_API_KEY });
});

// OpenAI: proxy chat completions (stream and non-stream)
app.post("/v1/chat/completions", async (req, res) => {
	try {
		const upstream = "https://api.openai.com/v1/chat/completions";
		const resp = await fetch(upstream, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${OPENAI_API_KEY}`,
			},
			body: JSON.stringify(req.body),
		});
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return res.status(resp.status).send(text || "Upstream error");
		}
		// If streaming, pipe as-is
		const contentType = resp.headers.get("content-type") || "";
		if (contentType.includes("text/event-stream")) {
			res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");
		} else {
			res.setHeader("Content-Type", "application/json");
		}
		const reader = resp.body.getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			res.write(Buffer.from(value));
		}
		res.end();
	} catch (e) {
		res.status(500).send(`Proxy error: ${(e && e.message) || "unknown"}`);
	}
});

// Gemini: streamGenerateContent
app.post("/v1beta/models/:model:streamGenerateContent", async (req, res) => {
	try {
		const model = req.params.model;
		const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`;
		const resp = await fetch(upstream, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(req.body),
		});
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return res.status(resp.status).send(text || "Upstream error");
		}
		res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		const reader = resp.body.getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			res.write(Buffer.from(value));
		}
		res.end();
	} catch (e) {
		res.status(500).send(`Proxy error: ${(e && e.message) || "unknown"}`);
	}
});

// Gemini: generateContent (non-stream) for simple connectivity testing
app.post("/v1beta/models/:model:generateContent", async (req, res) => {
	try {
		const model = req.params.model;
		const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
		const resp = await fetch(upstream, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(req.body),
		});
		const text = await resp.text().catch(() => "");
		return res.status(resp.status).send(text || "");
	} catch (e) {
		res.status(500).send(`Proxy error: ${(e && e.message) || "unknown"}`);
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`[proxy] listening on http://localhost:${PORT}`);
});


