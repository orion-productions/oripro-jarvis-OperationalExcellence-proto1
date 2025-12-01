import { useChatStore } from "../store/chatStore";
import { useState, useEffect, useRef } from "react";
import { t, type Language } from "../i18n/translations";

const SCRATCHPAD_KEY = "jarvis-scratchpad";

export function Sidebar() {
	const { conversations, createConversation, setActiveConversationId, deleteConversation, renameConversation, activeConversationId, settings } = useChatStore();
	const currentLang = (settings.language || 'en') as Language;
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState<string>("");
	const [scratchpad, setScratchpad] = useState<string>(() => {
		// Initialize from localStorage synchronously
		try {
			const saved = localStorage.getItem(SCRATCHPAD_KEY);
			return saved || "";
		} catch (error) {
			console.warn("Failed to load scratchpad from localStorage:", error);
			return "";
		}
	});
	const hasLoaded = useRef(false);

	// Mark as loaded after first render
	useEffect(() => {
		hasLoaded.current = true;
	}, []);

	// Save scratchpad to localStorage whenever it changes (debounced)
	useEffect(() => {
		// Don't save until after initial load
		if (!hasLoaded.current) {
			return;
		}

		// Debounce: save after 500ms of no changes
		const timeoutId = setTimeout(() => {
			try {
				localStorage.setItem(SCRATCHPAD_KEY, scratchpad);
			} catch (error) {
				console.warn("Failed to save scratchpad to localStorage:", error);
			}
		}, 500);

		return () => clearTimeout(timeoutId);
	}, [scratchpad]);

	return (
		<div className="h-full flex flex-col">
			{/* Chat List Section - 50% height */}
			<div className="flex flex-col" style={{ height: "50%" }}>
				<div className="p-3 flex-shrink-0">
					<button
						onClick={() => createConversation()}
						className="w-full rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-3 py-2 text-sm font-medium"
					>
						{t('newChat', currentLang)}
					</button>
				</div>
				<div className="flex-1 px-2 pb-2 overflow-y-auto space-y-1 min-h-0">
					{conversations.map(c => (
						<div key={c.id} className={`group flex items-center gap-2 rounded px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${activeConversationId === c.id ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}>
							{editingId === c.id ? (
								<form
									className="flex-1 flex items-center gap-2"
									onSubmit={async (e) => {
										e.preventDefault();
										await renameConversation(c.id, editValue);
										setEditingId(null);
									}}
								>
									<input
										autoFocus
										className="flex-1 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm"
										value={editValue}
										onChange={e => setEditValue(e.target.value)}
										onBlur={async () => {
											await renameConversation(c.id, editValue);
											setEditingId(null);
										}}
										onKeyDown={e => {
											if (e.key === "Escape") {
												setEditingId(null);
											}
										}}
									/>
									<button
										type="submit"
										className="text-sm rounded border border-neutral-300 dark:border-neutral-700 px-2 py-1"
									>
										Save
									</button>
								</form>
							) : (
								<>
									<button
										onClick={() => setActiveConversationId(c.id)}
										className="flex-1 text-left"
									>
										<div className="text-sm font-medium truncate">{c.title || "Untitled chat"}</div>
										<div className="text-xs text-neutral-500 truncate">{new Date(c.updatedAt).toLocaleString()}</div>
									</button>
									<button
										title={t('settings', currentLang)}
										onClick={(e) => {
											e.stopPropagation();
											setEditingId(c.id);
											setEditValue(c.title || "");
										}}
										className="opacity-60 hover:opacity-100 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
									>
										✏️
									</button>
									<button
										title={t('deleteChat', currentLang)}
										onClick={async (e) => {
											e.stopPropagation();
											await deleteConversation(c.id);
										}}
										className="opacity-60 hover:opacity-100 text-neutral-500 hover:text-red-600"
									>
										🗑
									</button>
								</>
							)}
						</div>
					))}
				</div>
			</div>

			{/* Divider */}
			<div className="border-t border-neutral-200 dark:border-neutral-800"></div>

			{/* Scratchpad Section - 50% height */}
			<div className="flex flex-col" style={{ height: "50%" }}>
				<div className="p-2 flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800">
					<div className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('scratchpad', currentLang)}</div>
				</div>
				<div className="flex-1 p-2 min-h-0">
					<textarea
						value={scratchpad}
						onChange={(e) => setScratchpad(e.target.value)}
						placeholder="Write notes, paste text, or use as a temporary workspace..."
						className="w-full h-full resize-none bg-transparent border border-neutral-300 dark:border-neutral-700 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
						style={{ fontFamily: "inherit" }}
					/>
				</div>
			</div>
		</div>
	);
}


