import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { getThemeFromUrl, resolveActiveTheme } from '../../utils/holidayTheme';

// Holiday theme assets, dropped in by the Claude Design handoff (docs/handoffs/HOLIDAY_THEMES_HANDOFF.md).
// Logos are eager (they're just URLs); each theme's CSS is only fetched when that theme is on.
const LOGOS = import.meta.glob('../../assets/images/holidays/buzzard-*.png', { eager: true, import: 'default' });
const STYLES = import.meta.glob('../../styles/holidays/*.css');

const logoFor = (key) => LOGOS[`../../assets/images/holidays/buzzard-${key}.png`] || null;

/** Whether a theme's design has landed yet (its stylesheet or logo exists), for the admin panel. */
export const themeIsDesigned = (key) =>
    Boolean(logoFor(key)) || Object.hasOwn(STYLES, `../../styles/holidays/${key}.css`);

// A preview sticks for the tab's session, so the admin can click around the site in it; the nav
// links don't carry the query string. `?theme=auto` drops back to the schedule.
const PREVIEW_KEY = 'obi-holiday-preview';
function readPreview(search) {
    const raw = new URLSearchParams(search).get('theme');
    try {
        if (raw === 'auto') sessionStorage.removeItem(PREVIEW_KEY);
        else if (raw !== null && getThemeFromUrl(search) !== undefined) sessionStorage.setItem(PREVIEW_KEY, raw);
        const stored = sessionStorage.getItem(PREVIEW_KEY);
        return stored === null ? undefined : getThemeFromUrl(`?theme=${stored}`);
    } catch {
        // Blocked storage: the preview still works on the page it was opened on.
        return getThemeFromUrl(search);
    }
}

/**
 * The active public-site holiday theme: { key, logo } where key is null when no theme is on and
 * logo is null when the theme has no logo variant (callers fall back to the normal logo).
 * `?theme=<key>` / `?theme=none` in the URL overrides the schedule, for previews.
 */
export default function useHolidayTheme() {
    const location = useLocation();
    const [config, setConfig] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.getHolidayThemeConfig()
            .then(c => { if (!cancelled) setConfig(c); })
            // Cosmetic only: if the lookup fails, run the default calendar.
            .catch(() => { if (!cancelled) setConfig({ mode: 'auto', overrides: {} }); });
        return () => { cancelled = true; };
    }, []);

    const preview = readPreview(location.search);
    const key = preview !== undefined ? preview : (config ? resolveActiveTheme(config) : null);

    useEffect(() => {
        const load = key && STYLES[`../../styles/holidays/${key}.css`];
        if (load) load();
    }, [key]);

    return { key, logo: key ? logoFor(key) : null };
}
