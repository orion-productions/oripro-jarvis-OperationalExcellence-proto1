import { describe, it, expect } from "vitest";
import { iterateSse } from "../vendor/llm";

function makeStream(lines: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const l of lines) controller.enqueue(encoder.encode(l + "\n"));
			controller.close();
		},
	});
}

describe("iterateSse", () => {
	it("yields data lines", async () => {
		const stream = makeStream([
			": keep-alive",
			"data: {\"a\":1}",
			"data: [DONE]",
		]);
		const chunks: string[] = [];
		for await (const c of iterateSse(stream)) chunks.push(c);
		expect(chunks).toEqual([ "{\"a\":1}", "[DONE]" ]);
	});
});


