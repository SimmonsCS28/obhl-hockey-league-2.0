const WING_FLAVORS = ['Original', 'Dry Rub', 'Buffalo', 'BBQ', 'Nude (Plain)'];
const WING_SAUCES = ['Blue Cheese', 'Ranch', 'BBQ', 'Buffalo'];

/** Shared Wings / Cheeseburger configurator modal — see CHICKEN_LICKS_ORDER_HANDBACK.md. */
function ItemConfigModal({ kind, draft, setDraft, onCancel, onConfirm, busy }) {
    const isWings = kind === 'wings';
    const price = isWings
        ? 13 + draft.sauces.length * 1 + (draft.celery ? 0.75 : 0)
        : 7.5 + (draft.bacon ? 2 : 0);
    const cannotConfirm = isWings ? !draft.flavor : false;

    const toggleSauce = (s) => setDraft(d => ({ ...d, sauces: d.sauces.includes(s) ? d.sauces.filter(x => x !== s) : [...d.sauces, s] }));
    const setQty = (n) => setDraft(d => ({ ...d, qty: Math.max(1, n) }));

    return (
        <div className="cl-modal-overlay" onClick={onCancel}>
            <div className="cl-modal" onClick={e => e.stopPropagation()}>
                <div className="cl-modal-title">{isWings ? 'Configure Wings' : 'Configure Cheeseburger'}</div>

                {isWings && (
                    <>
                        <div className="cl-modal-label">Flavor</div>
                        <div className="cl-pill-row">
                            {WING_FLAVORS.map(f => (
                                <button key={f} type="button" className={`cl-pill${draft.flavor === f ? ' is-selected' : ''}`}
                                    onClick={() => setDraft(d => ({ ...d, flavor: f }))}>{f}</button>
                            ))}
                        </div>

                        <div className="cl-modal-label">Sauces on the side (+$1 each)</div>
                        <div className="cl-pill-row">
                            {WING_SAUCES.map(s => (
                                <button key={s} type="button" className={`cl-pill${draft.sauces.includes(s) ? ' is-selected' : ''}`}
                                    onClick={() => toggleSauce(s)}>{draft.sauces.includes(s) ? `✓ ${s}` : s}</button>
                            ))}
                        </div>

                        <div className="cl-modal-hot-head">
                            <span className="cl-modal-label">Hotness</span>
                            <span className="cl-hot-label">{draft.hotMode === 'extra' ? `${draft.hotMultiplier}x Extra Sexy` : 'Sexy'}</span>
                        </div>
                        <div className="cl-pill-row">
                            <button type="button" className={`cl-pill${draft.hotMode === 'sexy' ? ' is-selected' : ''}`}
                                onClick={() => setDraft(d => ({ ...d, hotMode: 'sexy' }))}>Sexy</button>
                            <button type="button" className={`cl-pill${draft.hotMode === 'extra' ? ' is-selected' : ''}`}
                                onClick={() => setDraft(d => ({ ...d, hotMode: 'extra' }))}>Extra Sexy</button>
                        </div>
                        {draft.hotMode === 'extra' && (
                            <>
                                <input type="range" min="1" max="20" step="1" value={draft.hotMultiplier}
                                    onChange={e => setDraft(d => ({ ...d, hotMultiplier: Number(e.target.value) }))}
                                    className="cl-hot-slider" />
                                <div className="cl-hot-slider-labels"><span>1x Extra Sexy</span><span>20x Extra Sexy</span></div>
                            </>
                        )}

                        <label className="cl-checkbox-row">
                            <input type="checkbox" checked={draft.celery} onChange={() => setDraft(d => ({ ...d, celery: !d.celery }))} />
                            Extra Celery (+$0.75)
                        </label>
                    </>
                )}

                {!isWings && (
                    <label className="cl-checkbox-row">
                        <input type="checkbox" checked={draft.bacon} onChange={() => setDraft(d => ({ ...d, bacon: !d.bacon }))} />
                        Bacon (+$2.00)
                    </label>
                )}

                <div className="cl-modal-qty-row">
                    <div className="cl-qty-stepper">
                        <button type="button" onClick={() => setQty(draft.qty - 1)}>−</button>
                        <span>{draft.qty}</span>
                        <button type="button" onClick={() => setQty(draft.qty + 1)}>+</button>
                    </div>
                    <span className="cl-modal-price">${price.toFixed(2)} ea</span>
                </div>

                <div className="cl-modal-actions">
                    <button type="button" className="cl-btn cl-btn--ghost" onClick={onCancel}>Cancel</button>
                    <button type="button" className="cl-btn cl-btn--primary" disabled={busy || cannotConfirm} onClick={onConfirm}>Add to Order</button>
                </div>
            </div>
        </div>
    );
}

export default ItemConfigModal;
