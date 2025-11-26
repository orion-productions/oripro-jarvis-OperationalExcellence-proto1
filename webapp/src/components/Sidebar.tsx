import { useChatStore } from "../store/chatStore";
import { useState } from "react";

export function Sidebar() {
	const { conversations, createConversation, setActiveConversationId, deleteConversation, renameConversation, activeConversationId } = useChatStore();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState<string>("");

	return (
		<div className="h-full flex flex-col">
			<div className="p-3">
				<button
					onClick={() => createConversation()}
					className="w-full rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-3 py-2 text-sm font-medium"
				>
					New chat
				</button>
			</div>
			<div className="px-2 pb-2 overflow-y-auto space-y-1">
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
									title="Rename chat"
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
									title="Delete chat"
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
	);
}


