import {useEffect, useState} from 'preact/hooks';

/** Align to minute boundaries; suspend updates while another TV app is in front. */
export function useClock (): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		let timer = 0;
		const tick = () => {
			window.clearTimeout(timer);
			if (document.hidden) return;
			setNow(new Date());
			timer = window.setTimeout(tick, 60000 - Date.now() % 60000 + 30);
		};
		tick(); document.addEventListener('visibilitychange', tick);
		return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', tick); };
	}, []);
	return now;
}
