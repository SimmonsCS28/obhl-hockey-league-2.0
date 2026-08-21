import { useEffect, useState } from 'react';
import api from '../../services/api';
import './WeeklyHighlight.css';

const fmtPosted = (s) => {
    if (!s) return '';
    const d = new Date(s.endsWith('Z') ? s : s + 'Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * The weekly video highlight on the public home page.
 *
 * Renders nothing at all when no highlight is posted (or the fetch fails), so the
 * home page never shows an empty slot — same convention as the announcements block.
 */
function WeeklyHighlight() {
    const [highlight, setHighlight] = useState(null);
    // Live Barn's wide-angle export is panoramic (a real clip measured 4080x1360, i.e. 3:1),
    // not 16:9. Held in a fixed 16:9 box that letterboxes away ~41% of the frame as black
    // bars. Start at 16:9 so there's no layout jump before metadata arrives, then adopt the
    // clip's true ratio so the rink fills the space whatever the camera produced.
    const [ratio, setRatio] = useState(16 / 9);

    useEffect(() => {
        let cancelled = false;
        api.getCurrentHighlight()
            .then(data => { if (!cancelled) setHighlight(data); })
            .catch(err => {
                // A missing highlight must never break the rest of the home page.
                console.error('Failed to load weekly highlight:', err);
            });
        return () => { cancelled = true; };
    }, []);

    if (!highlight) return null;

    const meta = [
        highlight.week != null ? `Week ${highlight.week}` : null,
        fmtPosted(highlight.createdAt),
    ].filter(Boolean).join(' · ');

    return (
        <section className="obi-hl">
            <div className="obi-container">
                <div className="obi-hl-head">
                    <span className="obi-hl-pill">Highlight of the Week</span>
                    <span className="obi-hl-rule" />
                </div>

                <div className="obi-hl-card">
                    <div className="obi-hl-frame" style={{ aspectRatio: ratio }}>
                        <video
                            className="obi-hl-video"
                            src={highlight.videoUrl}
                            poster={highlight.posterUrl || undefined}
                            onLoadedMetadata={(e) => {
                                const { videoWidth: w, videoHeight: h } = e.currentTarget;
                                // Clamp: a corrupt or wildly off ratio shouldn't be able to
                                // produce a section that's one pixel tall or taller than the page.
                                if (w && h) setRatio(Math.min(Math.max(w / h, 1), 4));
                            }}
                            controls
                            // metadata (not auto) so the page doesn't pull 20MB for
                            // every visitor who never presses play.
                            preload="metadata"
                            playsInline
                        />
                    </div>

                    <div className="obi-hl-body">
                        <h3 className="obi-hl-title">{highlight.title}</h3>
                        {meta && <div className="obi-hl-meta">{meta}</div>}
                        {highlight.description && (
                            <p className="obi-hl-desc">{highlight.description}</p>
                        )}
                        {highlight.youtubeUrl && (
                            <a
                                className="obi-hl-yt"
                                href={highlight.youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Watch on YouTube →
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default WeeklyHighlight;
