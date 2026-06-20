import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import heroBg from '../../assets/images/buzzard-full.jpg';
import './RulesPage.css';

function RulesPage() {
    const [content, setContent] = useState('');
    const [lastUpdatedBy, setLastUpdatedBy] = useState('');
    const [lastUpdatedAt, setLastUpdatedAt] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toc, setToc] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const contentRef = useRef(null);

    useEffect(() => { loadRules(); }, []);

    const loadRules = async () => {
        try {
            setLoading(true);
            const data = await api.getRules();
            // The stored rich-text uses &nbsp; between every word, which blocks
            // line-wrapping and overflows. Collapse them to normal spaces so the
            // text wraps naturally. (Sectioned Rules Editor is the longer-term fix.)
            setContent((data.content || '').replace(/&nbsp;/g, ' '));
            setLastUpdatedBy(data.updatedByName || '');
            setLastUpdatedAt(data.updatedAt || '');
        } catch {
            setError('Unable to load the league rules. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    // Build the table of contents from the rendered content's headings, and
    // scroll-spy to highlight the section currently in view.
    useEffect(() => {
        const el = contentRef.current;
        if (!content || !el) return;

        const headings = Array.from(el.querySelectorAll('h1, h2, h3'));
        const items = headings.map((h, i) => {
            const text = (h.textContent || '').trim();
            const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
            const id = `rule-${i}-${slug}`;
            h.id = id;
            h.style.scrollMarginTop = '120px';
            return { id, text, level: h.tagName === 'H1' ? 1 : h.tagName === 'H2' ? 2 : 3 };
        });
        setToc(items);

        if (headings.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.id); });
            },
            { rootMargin: '-120px 0px -70% 0px' }
        );
        headings.forEach(h => observer.observe(h));
        return () => observer.disconnect();
    }, [content]);

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

    const lastUpdatedText = lastUpdatedAt
        ? `Last updated ${formatDate(lastUpdatedAt)}${lastUpdatedBy ? ` by ${lastUpdatedBy}` : ''}`
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
                ) : !content ? (
                    <div className="obi-rules-msg">League rules have not been posted yet. Check back soon!</div>
                ) : (
                    <div className={`obi-container obi-rules-grid ${toc.length === 0 ? 'no-toc' : ''}`}>
                        {toc.length > 0 && (
                            <aside className="obi-rules-sidebar obi-no-print">
                                <div className="obi-rules-toc-label">Contents</div>
                                <nav className="obi-rules-toc">
                                    {toc.map(item => (
                                        <button
                                            key={item.id}
                                            className={`obi-rules-toc-item level-${item.level} ${activeId === item.id ? 'is-active' : ''}`}
                                            onClick={() => goTo(item.id)}
                                        >
                                            {item.text}
                                        </button>
                                    ))}
                                </nav>
                            </aside>
                        )}
                        <main className="obi-rules-main">
                            <div
                                ref={contentRef}
                                className="obi-rules-content"
                                dangerouslySetInnerHTML={{ __html: content }}
                            />
                        </main>
                    </div>
                )}
            </section>
        </div>
    );
}

export default RulesPage;
