import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import heroBg from '../../assets/images/buzzard-full.jpg';
import './RulesPage.css';

// Group metadata (v4 §5a): key → ToC label + section chip + tone.
const GROUPS = [
    { key: 'gen', navLabel: 'General Info', chip: 'General League Information', tone: 'ice' },
    { key: 'game', navLabel: 'Game Rules', chip: 'OBHL Game Rules', tone: 'gold' },
    { key: 'mou', navLabel: 'Agreement', chip: 'Agreement', tone: 'green' },
];

function RulesPage() {
    const [sections, setSections] = useState([]);
    const [publishedBy, setPublishedBy] = useState('');
    const [publishedAt, setPublishedAt] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const contentRef = useRef(null);

    useEffect(() => { loadRules(); }, []);

    const loadRules = async () => {
        try {
            setLoading(true);
            const data = await api.getRules();
            // Stored rich-text uses &nbsp; between words, which blocks wrapping — collapse them.
            const clean = (data.sections || []).map(s => ({
                ...s,
                anchor: `rule-${s.id}`,
                content: (s.content || '').replace(/&nbsp;/g, ' '),
            }));
            setSections(clean);
            setPublishedBy(data.publishedBy || '');
            setPublishedAt(data.publishedAt || '');
        } catch {
            setError('Unable to load the league rules. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    // Scroll-spy: highlight the section currently in view.
    useEffect(() => {
        const el = contentRef.current;
        if (!sections.length || !el) return;
        const anchors = Array.from(el.querySelectorAll('[data-section-anchor]'));
        if (!anchors.length) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.id); });
            },
            { rootMargin: '-120px 0px -70% 0px' }
        );
        anchors.forEach(a => observer.observe(a));
        return () => observer.disconnect();
    }, [sections]);

    const formatDate = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
            return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        } catch {
            return '';
        }
    };

    const goTo = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Group sections for the ToC, preserving section order within each group.
    const grouped = GROUPS
        .map(g => ({ ...g, items: sections.filter(s => s.group === g.key) }))
        .filter(g => g.items.length > 0);

    const lastUpdatedText = publishedAt
        ? `Last updated ${formatDate(publishedAt)}${publishedBy ? ` by ${publishedBy}` : ''}`
        : 'Official rules and guidelines for the Old Buzzard Hockey League';

    return (
        <div className="obi-page obi-rules">
            <section className="obi-page-hero obi-no-print">
                <img src={heroBg} alt="" className="obi-page-hero-bg" />
                <div className="obi-page-hero-overlay" />
                <div className="obi-page-hero-inner obi-rules-hero-inner">
                    <div>
                        <div className="obi-eyebrow">Old Buzzard Hockey League</div>
                        <h1 className="obi-page-title">LEAGUE RULES</h1>
                        <p className="obi-page-sub">{lastUpdatedText}</p>
                    </div>
                    <button className="obi-rules-print-btn" onClick={() => window.print()}>
                        🖨 Print / Save PDF
                    </button>
                </div>
            </section>

            <section className="obi-rules-body">
                {loading ? (
                    <div className="obi-rules-msg">Loading league rules…</div>
                ) : error ? (
                    <div className="obi-rules-msg obi-neg">⚠️ {error}</div>
                ) : sections.length === 0 ? (
                    <div className="obi-rules-msg">League rules have not been posted yet. Check back soon!</div>
                ) : (
                    <div className="obi-container obi-rules-grid">
                        <aside className="obi-rules-sidebar obi-no-print">
                            <div className="obi-rules-toc-label">Contents</div>
                            <nav className="obi-rules-toc">
                                {grouped.map(g => (
                                    <div key={g.key} className="obi-rules-toc-group-block">
                                        <div className={`obi-rules-toc-group tone-${g.tone}`}>{g.navLabel}</div>
                                        {g.items.map(s => (
                                            <button
                                                key={s.id}
                                                className={`obi-rules-toc-item ${activeId === s.anchor ? 'is-active' : ''}`}
                                                onClick={() => goTo(s.anchor)}
                                            >
                                                {s.title}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </nav>
                        </aside>

                        <main className="obi-rules-main" ref={contentRef}>
                            {sections.map(s => {
                                const g = GROUPS.find(x => x.key === s.group) || GROUPS[0];
                                return (
                                    <section
                                        key={s.id}
                                        id={s.anchor}
                                        data-section-anchor
                                        className="obi-rules-section"
                                    >
                                        <span className={`obi-rules-section-chip tone-${g.tone}`}>{g.chip}</span>
                                        <h2 className="obi-rules-section-title">{s.title}</h2>
                                        <div
                                            className="obi-rules-content"
                                            dangerouslySetInnerHTML={{ __html: s.content }}
                                        />
                                    </section>
                                );
                            })}
                        </main>
                    </div>
                )}
            </section>
        </div>
    );
}

export default RulesPage;
