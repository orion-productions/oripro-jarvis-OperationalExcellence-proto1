import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { SettingsModal } from "./components/SettingsModal";
import { RightPanel } from "./components/RightPanel";
import { useChatStore } from "./store/chatStore";

export default function App() {
	const { ensureInitialized, ui, setUi } = useChatStore();
	const leftWidth = ui.leftWidth ?? 280;
	const rightWidth = ui.rightWidth ?? 320;
	const RESIZER_W = 4;
	const MIN_LEFT = 200;
	const MAX_LEFT = 500;
	const MIN_RIGHT = 240;
	const MAX_RIGHT = 560;

	useEffect(() => {
		ensureInitialized();
	}, [ensureInitialized]);

	function onDragLeft(e: React.MouseEvent) {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = leftWidth;
		function onMove(ev: MouseEvent) {
			const delta = ev.clientX - startX;
			let next = startWidth + delta;
			if (next < MIN_LEFT) next = MIN_LEFT;
			if (next > MAX_LEFT) next = MAX_LEFT;
			setUi({ leftWidth: next });
		}
		function onUp() {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		}
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	function onDragRight(e: React.MouseEvent) {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = rightWidth;
		function onMove(ev: MouseEvent) {
			const delta = startX - ev.clientX;
			let next = startWidth + delta;
			if (next < MIN_RIGHT) next = MIN_RIGHT;
			if (next > MAX_RIGHT) next = MAX_RIGHT;
			setUi({ rightWidth: next });
		}
		function onUp() {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		}
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	return (
		<div
			className="app-grid"
			style={{ gridTemplateColumns: `${leftWidth}px ${RESIZER_W}px 1fr ${RESIZER_W}px ${rightWidth}px` }}
		>
			<aside className="sidebar border-r border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/60 backdrop-blur">
				<Sidebar />
			</aside>
			<div className="resizer resizerL" onMouseDown={onDragLeft} />
			<header className="header border-b border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/60 backdrop-blur">
				<ChatHeader />
			</header>
			<main className="main overflow-y-auto">
				<MessageList />
			</main>
			<div className="resizer resizerR" onMouseDown={onDragRight} />
			<aside className="rightbar bg-white/60 dark:bg-neutral-950/60 backdrop-blur">
				<RightPanel />
			</aside>
			<footer className="composer border-t border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/60 backdrop-blur">
				<Composer />
			</footer>
			{ui.showSettings && <SettingsModal />}
		</div>
	);
}


