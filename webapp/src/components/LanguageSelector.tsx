import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../store/chatStore";
import { languages, type Language, t } from "../i18n/translations";

export function LanguageSelector() {
	const { settings, updateSettings } = useChatStore();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const currentLang = (settings.language || 'en') as Language;
	const currentLangInfo = languages.find(l => l.code === currentLang) || languages[0];

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		}

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
	}, [isOpen]);

	const handleLanguageChange = (langCode: Language) => {
		updateSettings({ ...settings, language: langCode });
		setIsOpen(false);
	};

	return (
		<div ref={dropdownRef} className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="text-[11px] px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1"
				title={t('selectLanguage', currentLang)}
			>
				<span>{currentLangInfo.nativeName}</span>
				<svg
					className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-1 w-48 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded shadow-lg z-50 max-h-64 overflow-y-auto">
					{languages.map((lang) => (
						<button
							key={lang.code}
							onClick={() => handleLanguageChange(lang.code)}
							className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between ${
								lang.code === currentLang ? 'bg-neutral-100 dark:bg-neutral-700 font-semibold' : ''
							}`}
						>
							<span>{lang.nativeName}</span>
							<span className="text-xs text-neutral-500">{lang.name}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

