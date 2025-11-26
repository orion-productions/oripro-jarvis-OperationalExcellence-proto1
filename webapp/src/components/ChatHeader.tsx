import { useChatStore } from "../store/chatStore";

export function ChatHeader() {
	const settings = useChatStore(s => s.settings);
	const setUi = useChatStore(s => s.setUi);
	const activeConversation = useChatStore(s => s.conversations.find(c => c.id === s.activeConversationId));
	return (
		<div className="h-14 flex items-center justify-between px-4">
			<div className="text-sm text-neutral-500">
				Model: <span className="font-medium">{settings.model}</span> · Provider: <span className="font-medium">{settings.provider}</span>
			</div>
			<div className="flex items-center gap-2">
				<div className="text-sm text-neutral-500">{activeConversation?.title || "New chat"}</div>
				<button
					onClick={() => setUi({ showSettings: true })}
					className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					Settings
				</button>
			</div>
		</div>
	);
}


