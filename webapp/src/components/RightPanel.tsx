import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/chatStore";
import { RecordingControl } from "./RecordingControl";
import { LanguageSelector } from "./LanguageSelector";
import { t, type Language } from "../i18n/translations";

export function RightPanel() {
	const { ui, setUi, activeTools, setToolActive, settings } = useChatStore();
	const currentLang = (settings.language || 'en') as Language;
	const topHeight = ui.rightTopHeight ?? 240;
	const MIN_TOP = 120;
	const MIN_BOTTOM = 120;
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [tools, setTools] = useState<{ name: string; title?: string }[]>([]);
	const [toolsError, setToolsError] = useState<string>("");
	const [billingStatus, setBillingStatus] = useState<{
		gmail: { used: number; limit: number; percent: number };
		calendar: { used: number; limit: number; percent: number };
		slack?: { used: number; limit: number; percent: number };
		github?: { used: number; limit: number; percent: number };
		costs: { thisMonth: number; limit: number };
		authenticated: boolean;
	} | null>(null);

	function onDragRow(e: React.MouseEvent) {
		e.preventDefault();
		const startY = e.clientY;
		const startH = topHeight;
		function onMove(ev: MouseEvent) {
			const container = containerRef.current;
			if (!container) return;
			const rect = container.getBoundingClientRect();
			// delta positive increases top height
			let next = startH + (ev.clientY - startY);
			// clamp to ensure bottom >= MIN_BOTTOM
			const maxTop = Math.max(MIN_TOP, rect.height - MIN_BOTTOM - 4);
			if (next < MIN_TOP) next = MIN_TOP;
			if (next > maxTop) next = maxTop;
			setUi({ rightTopHeight: next });
		}
		function onUp() {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		}
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	// Load billing status from server
	useEffect(() => {
		let aborted = false;
		const loadBilling = async () => {
			if (aborted) return;
			try {
				const r = await fetch("http://localhost:3001/mcp/billing/status", { cache: "no-store" });
				if (r.ok) {
					const data = await r.json();
					if (!aborted && data.ok) {
						setBillingStatus({
							gmail: data.usage.gmail,
							calendar: data.usage.calendar,
							costs: data.usage.costs,
							authenticated: data.authenticated
						});
					}
				}
			} catch (e) {
				// Silently fail - billing is optional
			}
		};
		loadBilling();
		const interval = setInterval(loadBilling, 60000); // Update every minute
		return () => {
			aborted = true;
			clearInterval(interval);
		};
	}, []);

	// Load MCP tools list from local server (with simple retry)
	useEffect(() => {
		let aborted = false;
		let retries = 0;
		const load = async () => {
			if (aborted) return;
			try {
				setToolsError("");
				const r = await fetch("http://localhost:3001/mcp/tools", { cache: "no-store" });
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				const j = await r.json();
				if (!aborted) setTools(Array.isArray(j.tools) ? j.tools : []);
			} catch (e) {
				if (!aborted) {
					setToolsError((e as Error)?.message || "Failed to load tools");
					// retry a few times if server just started
					if (retries < 10) {
						retries++;
						setTimeout(load, 1000);
					}
				}
			}
		};
		load();
		return () => { aborted = true; };
	}, []);

	useEffect(() => {
		const canvasMaybe = canvasRef.current as HTMLCanvasElement | null;
		if (!canvasMaybe) return;
		const ctxMaybe = canvasMaybe.getContext("2d") as CanvasRenderingContext2D | null;
		if (!ctxMaybe) return;
		const canvasEl: HTMLCanvasElement = canvasMaybe;
		const ctx2d: CanvasRenderingContext2D = ctxMaybe;

		let raf = 0;
		function resize() {
			const parent = canvasEl.parentElement as HTMLElement | null;
			if (!parent) return;
			const { width, height } = parent.getBoundingClientRect();
			const ratio = window.devicePixelRatio || 1;
			canvasEl.width = Math.max(1, Math.floor(width * ratio));
			canvasEl.height = Math.max(1, Math.floor(height * ratio));
			canvasEl.style.width = `${Math.max(1, Math.floor(width))}px`;
			canvasEl.style.height = `${Math.max(1, Math.floor(height))}px`;
			ctx2d.setTransform(ratio, 0, 0, ratio, 0, 0);
		}
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(canvasEl.parentElement as Element);

		function draw(t: number) {
			const { width, height } = canvasEl;
			ctx2d.clearRect(0, 0, width, height);
			// logical size uses CSS pixels due to transform above
			const w = Number(canvasEl.style.width.replace("px","")) || width;
			const h = Number(canvasEl.style.height.replace("px","")) || height;
			const cx = w / 2;
			const cy = h / 2;
			const size = Math.max(40, Math.min(w, h) * 0.3);

			ctx2d.save();
			ctx2d.translate(cx, cy);
			ctx2d.rotate((t / 1000) % (Math.PI * 2));
			ctx2d.beginPath();
			ctx2d.moveTo(0, -size);
			ctx2d.lineTo(size * 0.866, size * 0.5);  // cos60,sin60
			ctx2d.lineTo(-size * 0.866, size * 0.5);
			ctx2d.closePath();
			ctx2d.fillStyle = "#10b981"; // emerald-500
			ctx2d.fill();
			ctx2d.lineWidth = 2;
			ctx2d.strokeStyle = "#065f46"; // emerald-800
			ctx2d.stroke();
			ctx2d.restore();

			raf = requestAnimationFrame(draw);
		}
		raf = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	}, [ui.rightTopHeight]);

	return (
		<div ref={containerRef} className="h-full flex flex-col">
			<div style={{ height: topHeight }} className="border-b border-neutral-200 dark:border-neutral-800 flex flex-col">
				<div className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span>{t('mcpTools', currentLang)}</span>
						<button
							className="text-[11px] px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
							onClick={() => {
								(async () => {
									try {
										setToolsError("");
										const r = await fetch("http://localhost:3001/mcp/tools", { cache: "no-store" });
										if (!r.ok) throw new Error(`HTTP ${r.status}`);
										const j = await r.json();
										setTools(Array.isArray(j.tools) ? j.tools : []);
									} catch (e) {
										setToolsError((e as Error)?.message || t('failedToLoadTools', currentLang));
									}
								})();
							}}
							title={t('refreshTools', currentLang)}
						>
							{t('refresh', currentLang)}
						</button>
						{/* Billing/Usage Display */}
						{billingStatus && (
							<div className="flex items-center gap-1.5 text-[10px] normal-case">
								{/* ===== GOOGLE ONLY (CAN HAVE BILLING) ===== */}
								<div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800" title={t('googleServices', currentLang) + ' - ' + t('mayIncurCosts', currentLang)}>
									<span className={`font-mono font-semibold ${billingStatus.costs.thisMonth > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-500'}`}>
										💰${billingStatus.costs.thisMonth.toFixed(2)}
									</span>
									<span className="text-neutral-400 dark:text-neutral-600">|</span>
									{/* Gmail usage */}
									<span 
										className={`${
											billingStatus.gmail.percent > 80 ? 'text-orange-600 dark:text-orange-400' : 
											billingStatus.gmail.percent > 50 ? 'text-yellow-600 dark:text-yellow-500' : 
											'text-neutral-600 dark:text-neutral-400'
										}`}
										title={`${t('gmail', currentLang)}: ${billingStatus.gmail.used.toLocaleString()}/${billingStatus.gmail.limit.toLocaleString()} units (Google - free tier, may cost if exceeded)`}
									>
										📧{billingStatus.gmail.percent.toFixed(1)}%
									</span>
									{/* Calendar usage */}
									<span 
										className={`${
											billingStatus.calendar.percent > 80 ? 'text-orange-600 dark:text-orange-400' : 
											billingStatus.calendar.percent > 50 ? 'text-yellow-600 dark:text-yellow-500' : 
											'text-neutral-600 dark:text-neutral-400'
										}`}
										title={`${t('calendar', currentLang)}: ${billingStatus.calendar.used.toLocaleString()}/${billingStatus.calendar.limit.toLocaleString()} queries (Google - free tier, may cost if exceeded)`}
									>
										📅{billingStatus.calendar.percent.toFixed(1)}%
									</span>
									{/* Auth status */}
									{!billingStatus.authenticated && (
										<span className="text-yellow-600" title={t('notAuthenticated', currentLang)}>
											🔒
										</span>
									)}
								</div>
								
								{/* ===== FREE SERVICES (NO BILLING EVER) ===== */}
								{(billingStatus.slack || billingStatus.github) && (
									<>
										<span className="text-neutral-400 dark:text-neutral-600">|</span>
										<div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" title={t('freeServices', currentLang) + ' - ' + t('noBillingEver', currentLang)}>
											{/* Slack (100% FREE) */}
											{billingStatus.slack && (
												<span 
													className={`${
														billingStatus.slack.percent > 80 ? 'text-orange-600 dark:text-orange-400' : 
														billingStatus.slack.percent > 50 ? 'text-yellow-600 dark:text-yellow-500' : 
														'text-neutral-600 dark:text-neutral-400'
													}`}
													title={`${t('slack', currentLang)}: ${billingStatus.slack.used.toLocaleString()}/${billingStatus.slack.limit.toLocaleString()} requests (100% FREE - no billing ever)`}
												>
													💬{billingStatus.slack.percent.toFixed(1)}%
												</span>
											)}
											{/* GitHub (100% FREE) */}
											{billingStatus.github && (
												<>
													{billingStatus.slack && <span className="text-neutral-400 dark:text-neutral-600">|</span>}
													<span 
														className={`${
															billingStatus.github.percent > 80 ? 'text-orange-600 dark:text-orange-400' : 
															billingStatus.github.percent > 50 ? 'text-yellow-600 dark:text-yellow-500' : 
															'text-neutral-600 dark:text-neutral-400'
														}`}
														title={`${t('github', currentLang)}: ${billingStatus.github.used.toLocaleString()}/${billingStatus.github.limit.toLocaleString()} requests (100% FREE - no billing ever)`}
													>
														🐙{billingStatus.github.percent.toFixed(1)}%
													</span>
												</>
											)}
										</div>
									</>
								)}
							</div>
						)}
					</div>
					<LanguageSelector />
				</div>
				<div className="px-3 pb-2 text-sm flex-1 overflow-y-auto">
					{toolsError ? (
						<div className="text-red-600">{t('failedToLoadTools', currentLang)}: {toolsError}</div>
					) : tools.length === 0 ? (
						<div className="text-neutral-500">{t('noToolsFound', currentLang)}</div>
					) : (
						<ul className="space-y-1">
							{tools.map(t => (
								<li key={t.name} className="text-neutral-800 dark:text-neutral-200 text-sm flex items-center gap-2">
									<input
										type="checkbox"
										checked={!!activeTools[t.name]}
										onChange={e => setToolActive(t.name, e.target.checked)}
									/>
									<span className="font-medium">{t.title || t.name}</span>
									<span className="text-neutral-500">({t.name})</span>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
			<div className="row-resizer" onMouseDown={onDragRow} />
			{/* Meeting Recording Control - Between MCP Tools and Window */}
			<div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
				<RecordingControl />
			</div>
			<div className="flex-1 flex flex-col">
				<div className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
					{t('window', currentLang)}
				</div>
				<div className="flex-1 relative">
					<canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
				</div>
			</div>
		</div>
	);
}


