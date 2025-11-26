import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import * as llm from "../vendor/llm";
import { useChatStore } from "../store/chatStore";

describe("chat store", () => {
	beforeEach(() => {
		// reset store
		const { getState, setState } = useChatStore;
		setState({ ...getState(), conversations: [], activeConversationId: undefined });
	});

	it("creates a conversation and sends a message", async () => {
		const gen = (async function* () {
			yield "Hello";
			yield ", world!";
		})();
		const spy = vi.spyOn(llm, "sendWithProvider").mockReturnValue(gen as any);

		const { createConversation, sendMessage } = useChatStore.getState();
		await act(async () => {
			await createConversation();
		});
		expect(useChatStore.getState().conversations.length).toBe(1);
		await act(async () => {
			await sendMessage("Hi");
		});
		const conv = useChatStore.getState().conversations[0];
		expect(conv.messages.length).toBe(2);
		expect(conv.messages[1].content).toBe("Hello, world!");
		spy.mockRestore();
	});
});


