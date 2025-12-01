// Meeting Analysis Service
// Provides summarization and sentiment analysis for meeting transcripts

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * Get the available AI provider
 */
function getAIProvider() {
	if (OPENAI_API_KEY) {
		return "openai";
	} else if (GEMINI_API_KEY) {
		return "gemini";
	}
	return null;
}

/**
 * Summarize a meeting transcript
 */
async function summarizeMeeting(transcript) {
	const provider = getAIProvider();
	if (!provider) {
		throw new Error("No AI provider configured. Please set OPENAI_API_KEY or GEMINI_API_KEY");
	}
	
	const fullText = transcript.fullText || transcript.segments?.map(s => s.text).join(" ") || "";
	
	if (!fullText.trim()) {
		throw new Error("Transcript is empty");
	}
	
	const prompt = `Please provide a concise summary of the following meeting transcript. Include:
1. Main topics discussed
2. Key decisions made
3. Action items (if any)
4. Important points

Meeting transcript:
${fullText}

Summary:`;
	
	if (provider === "openai") {
		return await summarizeWithOpenAI(prompt);
	} else if (provider === "gemini") {
		return await summarizeWithGemini(prompt);
	}
}

/**
 * Analyze sentiment of a meeting
 */
async function analyzeSentiment(transcript) {
	const provider = getAIProvider();
	if (!provider) {
		throw new Error("No AI provider configured. Please set OPENAI_API_KEY or GEMINI_API_KEY");
	}
	
	const fullText = transcript.fullText || transcript.segments?.map(s => s.text).join(" ") || "";
	
	if (!fullText.trim()) {
		throw new Error("Transcript is empty");
	}
	
	const prompt = `Analyze the sentiment of the following meeting transcript. Provide:
1. Overall sentiment (positive, neutral, or negative)
2. A sentiment score from -1 (very negative) to 1 (very positive)
3. Brief explanation

Meeting transcript:
${fullText}

Analysis:`;
	
	if (provider === "openai") {
		return await analyzeSentimentWithOpenAI(prompt);
	} else if (provider === "gemini") {
		return await analyzeSentimentWithGemini(prompt);
	}
}

/**
 * Summarize using OpenAI
 */
async function summarizeWithOpenAI(prompt) {
	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [
					{ role: "user", content: prompt }
				],
				temperature: 0.7,
				max_tokens: 1000
			})
		});
		
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenAI API error: ${response.status} - ${error}`);
		}
		
		const data = await response.json();
		return data.choices[0].message.content.trim();
	} catch (error) {
		throw new Error(`Failed to summarize with OpenAI: ${error.message}`);
	}
}

/**
 * Summarize using Gemini
 */
async function summarizeWithGemini(prompt) {
	try {
		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				contents: [{
					parts: [{
						text: prompt
					}]
				}],
				generationConfig: {
					temperature: 0.7,
					maxOutputTokens: 1000
				}
			})
		});
		
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Gemini API error: ${response.status} - ${error}`);
		}
		
		const data = await response.json();
		return data.candidates[0].content.parts[0].text.trim();
	} catch (error) {
		throw new Error(`Failed to summarize with Gemini: ${error.message}`);
	}
}

/**
 * Analyze sentiment using OpenAI
 */
async function analyzeSentimentWithOpenAI(prompt) {
	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [
					{ role: "user", content: prompt }
				],
				temperature: 0.3,
				max_tokens: 500
			})
		});
		
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenAI API error: ${response.status} - ${error}`);
		}
		
		const data = await response.json();
		const analysis = data.choices[0].message.content.trim();
		
		// Parse sentiment from response
		return parseSentimentResponse(analysis);
	} catch (error) {
		throw new Error(`Failed to analyze sentiment with OpenAI: ${error.message}`);
	}
}

/**
 * Analyze sentiment using Gemini
 */
async function analyzeSentimentWithGemini(prompt) {
	try {
		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				contents: [{
					parts: [{
						text: prompt
					}]
				}],
				generationConfig: {
					temperature: 0.3,
					maxOutputTokens: 500
				}
			})
		});
		
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Gemini API error: ${response.status} - ${error}`);
		}
		
		const data = await response.json();
		const analysis = data.candidates[0].content.parts[0].text.trim();
		
		// Parse sentiment from response
		return parseSentimentResponse(analysis);
	} catch (error) {
		throw new Error(`Failed to analyze sentiment with Gemini: ${error.message}`);
	}
}

/**
 * Parse sentiment response from AI
 */
function parseSentimentResponse(text) {
	const lowerText = text.toLowerCase();
	
	// Extract sentiment label
	let overall = "neutral";
	if (lowerText.includes("positive") || lowerText.includes("optimistic") || lowerText.includes("good")) {
		overall = "positive";
	} else if (lowerText.includes("negative") || lowerText.includes("pessimistic") || lowerText.includes("bad") || lowerText.includes("concern")) {
		overall = "negative";
	}
	
	// Extract score (look for numbers between -1 and 1)
	const scoreMatch = text.match(/(-?\d+\.?\d*)/);
	let score = 0;
	if (scoreMatch) {
		score = parseFloat(scoreMatch[1]);
		if (score > 1) score = score / 10; // If it's 0-10 scale, convert to -1 to 1
		if (score < -1) score = -1;
		if (score > 1) score = 1;
	} else {
		// Estimate score from sentiment
		if (overall === "positive") score = 0.5;
		else if (overall === "negative") score = -0.5;
	}
	
	return {
		overall,
		score,
		analysis: text
	};
}

module.exports = {
	summarizeMeeting,
	analyzeSentiment
};

