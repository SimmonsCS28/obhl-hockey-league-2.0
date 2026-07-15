import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import ItemConfigModal from './ItemConfigModal';
import { defaultWingsDraft, defaultBurgerDraft } from './chickenLicksDrafts';
import chickenLicksLogo from '../../../assets/images/chicken-licks-logo.png';
import './ChickenLicksSection.css';

const TZ = 'America/Chicago';
const money = (v) => Number(v || 0).toFixed(2);
const fmtWhen = (s) => {
    if (!s) return '';
    const normalized = /[Z+]/.test(s) ? s : s + 'Z';
    const d = new Date(normalized);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ }) + ' · '
        + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
};

const MENU = [
    { category: 'Wings', items: [{ key: 'wings', label: 'Wings', price: 13.00, note: '$13/basket — choose one flavor', configurable: 'wings' }] },
    { category: 'Sandwiches', items: [
        { key: 'sandwich_poboy', label: 'Chicken Po-Boy', price: 11.50 },
        { key: 'sandwich_crispy_chicken', label: 'Crispy Chicken', price: 7.00 },
        { key: 'sandwich_grilled_chicken', label: 'Grilled Chicken', price: 7.00 },
        { key: 'sandwich_crispy_cod', label: 'Crispy Cod', price: 7.50 },
    ] },
    { category: 'Baskets', items: [
        { key: 'basket_chicken_strips', label: 'Chicken Strips', price: 12.00 },
        { key: 'basket_shrimp', label: 'Shrimp', price: 12.00 },
        { key: 'basket_crispy_cod', label: 'Crispy Cod', price: 12.00 },
    ] },
    { category: 'Burgers', items: [
        { key: 'cheeseburger', label: 'Cheeseburger', price: 7.50, configurable: 'cheeseburger' },
    ] },
    { category: 'Appetizers', items: [
        { key: 'app_cheese_curds', label: 'Cheese Curds', price: 6.00 },
        { key: 'app_jalapeno_poppers', label: 'Jalapeno Poppers', price: 6.00 },
        { key: 'app_onion_rings', label: 'Onion Rings', price: 6.00 },
        { key: 'app_mac_cheese_bites', label: 'Mac & Cheese Bites', price: 6.00 },
        { key: 'app_mushrooms', label: 'Mushrooms', price: 6.00 },
        { key: 'app_breaded_pickle_chips', label: 'Breaded Pickle Chips', price: 6.00 },
        { key: 'app_pub_chips', label: 'Pub Chips', price: 5.00 },
        { key: 'app_waffle_fries', label: 'Waffle Fries', price: 5.00 },
        { key: 'app_tater_tots', label: 'Tater Tots', price: 5.00 },
        { key: 'app_french_fries', label: 'French Fries', price: 4.50 },
        { key: 'app_cole_slaw', label: 'Cole Slaw', price: 2.00 },
    ] },
    { category: 'Extras', items: [
        { key: 'blue_cheese_pint', label: 'Blue Cheese Pint', price: 7.00 },
    ] },
];

/**
 * Chicken Licks team-ordering zone on the user Dashboard. `openOrders` and
 * `onRefresh` are owned by Dashboard.jsx (shared with the teammate-notice
 * banner rendered elsewhere on the page) — see CHICKEN_LICKS_ORDER_HANDBACK.md.
 */
function ChickenLicksSection({ seasonId, openOrders, onRefresh }) {
    const [editingOrderKey, setEditingOrderKey] = useState(null);
    const [wingsDraft, setWingsDraft] = useState(null);
    const [burgerDraft, setBurgerDraft] = useState(null);
    const [history, setHistory] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const loadHistory = useCallback(() => {
        if (!seasonId) return;
        api.getChickenLicksHistory(seasonId).then(setHistory).catch(() => setHistory([]));
    }, [seasonId]);
    useEffect(() => { loadHistory(); }, [loadHistory]);

    const personalOrder = openOrders?.personalOrder || null;
    const teamOrder = openOrders?.teamOrder || null;

    const run = async (fn) => {
        setBusy(true); setError('');
        try {
            await fn();
            await Promise.all([onRefresh(), loadHistory()]);
        } catch (e) {
            setError(e.message || 'Something went wrong');
        } finally {
            setBusy(false);
        }
    };

    const startPersonal = () => run(() => api.startChickenLicksPersonalOrder(seasonId));
    const startTeam = () => run(() => api.startChickenLicksTeamOrder(seasonId));
    const openBuilder = (key) => { setEditingOrderKey(key); setNotice(''); };
    const closeBuilder = () => setEditingOrderKey(null);

    const addPlain = (itemKey) => run(() => api.addChickenLicksItem(editingOrderKey, seasonId, { itemKey, qty: 1 }));
    const bumpPlain = (item, delta) => run(() => api.updateChickenLicksItemQty(item.id, item.qty + delta));
    const changeQty = (item, qty) => run(() => api.updateChickenLicksItemQty(item.id, qty));
    const removeItem = (item) => run(() => api.removeChickenLicksItem(item.id));

    const confirmWings = () => run(async () => {
        await api.addChickenLicksItem(editingOrderKey, seasonId, { itemKey: 'wings', ...wingsDraft });
        setWingsDraft(null);
    });
    const confirmBurger = () => run(async () => {
        await api.addChickenLicksItem(editingOrderKey, seasonId, { itemKey: 'cheeseburger', bacon: burgerDraft.bacon, qty: burgerDraft.qty });
        setBurgerDraft(null);
    });

    const moveToTeam = () => run(() => api.moveChickenLicksToTeam(seasonId));
    const closeTeam = () => run(() => api.closeChickenLicksTeamOrder(seasonId));
    const placePersonal = () => run(() => api.placeChickenLicksPersonalOrder());
    const cancelOrder = (key) => run(() => api.cancelChickenLicksOrder(key, seasonId));

    const doReorder = async (id) => {
        setBusy(true); setError(''); setNotice('');
        try {
            await api.reorderChickenLicks(id, seasonId);
            await onRefresh();
            setNotice('Loaded from a past order — review and edit before calling.');
        } catch (e) {
            setError(e.message || 'Something went wrong');
        } finally {
            setBusy(false);
        }
    };

    const editingOrder = editingOrderKey === 'team' ? teamOrder : editingOrderKey === 'personal' ? personalOrder : null;
    const editingLabel = editingOrderKey === 'team'
        ? `Team Order — ${teamOrder?.teamName || openOrders?.myTeamName || ''}`
        : 'My Personal Order';

    return (
        <section id="chicken-licks" className="cl-section">
            <div className="obi-container">
                <header className="cl-header">
                    <img src={chickenLicksLogo} alt="Chicken Licks" className="cl-logo" />
                    <div className="cl-title-block">
                        <h2 className="cl-title">Chicken Licks</h2>
                        <p className="cl-desc">Build your order right here, then call it in — the summary stays on
                            screen so whoever's calling can read it straight off the phone. Personal and team orders
                            are separate and can both be open at once.</p>
                    </div>
                    <div className="cl-contact">Chicken Licks Bar &amp; Grill · (608) 837-6721 · 11am–2am</div>
                </header>

                {error && <div className="cl-alert cl-alert--error">{error}</div>}
                {notice && <div className="cl-alert cl-alert--notice">{notice}</div>}

                {editingOrderKey ? (
                    <MenuBuilder
                        editingLabel={editingLabel}
                        order={editingOrder}
                        onDone={closeBuilder}
                        onAddPlain={addPlain}
                        onBumpPlain={bumpPlain}
                        onOpenWings={() => setWingsDraft(defaultWingsDraft())}
                        onOpenBurger={() => setBurgerDraft(defaultBurgerDraft())}
                        busy={busy}
                    />
                ) : (
                    <>
                        <div className="cl-entry-actions">
                            {teamOrder && openOrders?.teamOrderJoinable && (
                                <div className="cl-join-card">
                                    <span><b>{teamOrder.initiatorName}</b> already started a team order for {teamOrder.teamName}. Join it to add your items.</span>
                                    <button type="button" className="cl-btn cl-btn--primary" disabled={busy} onClick={() => openBuilder('team')}>Add My Items</button>
                                </div>
                            )}
                            {!personalOrder && (
                                <button type="button" className="cl-btn cl-btn--primary" disabled={busy} onClick={startPersonal}>Start My Order</button>
                            )}
                            {!teamOrder && openOrders?.myTeamId && (
                                <button type="button" className="cl-btn cl-btn--primary" disabled={busy} onClick={startTeam}>Start a Team Order</button>
                            )}
                        </div>

                        <div className="cl-orders">
                            {personalOrder && (
                                <OrderCard
                                    order={personalOrder}
                                    title="My Personal Order"
                                    subtitle="Just for you"
                                    onAddItems={() => openBuilder('personal')}
                                    onChangeQty={changeQty}
                                    onRemove={removeItem}
                                    actions={<>
                                        <a className="cl-btn cl-btn--call" href="tel:+16088376721">☎ Call Chicken Licks</a>
                                        {teamOrder && teamOrder.status === 'OPEN' && (
                                            <button type="button" className="cl-btn cl-btn--outline" disabled={busy} onClick={moveToTeam}>Move to Team Order ({teamOrder.teamName})</button>
                                        )}
                                        <button type="button" className="cl-btn cl-btn--muted" disabled={busy} onClick={placePersonal}>Order Placed</button>
                                        <button type="button" className="cl-btn cl-btn--text" disabled={busy} onClick={() => cancelOrder('personal')}>Cancel</button>
                                    </>}
                                />
                            )}
                            {teamOrder && (
                                <OrderCard
                                    order={teamOrder}
                                    title={`Team Order — ${teamOrder.teamName}`}
                                    subtitle={teamOrder.status === 'CLOSED' ? null : `Started by ${teamOrder.initiatorName}`}
                                    closed={teamOrder.status === 'CLOSED'}
                                    onAddItems={teamOrder.status === 'OPEN' ? () => openBuilder('team') : null}
                                    onChangeQty={changeQty}
                                    onRemove={removeItem}
                                    actions={<>
                                        <a className="cl-btn cl-btn--call" href="tel:+16088376721">☎ Call Chicken Licks</a>
                                        {teamOrder.mineInitiated ? (
                                            teamOrder.status === 'OPEN'
                                                ? <button type="button" className="cl-btn cl-btn--outline" disabled={busy} onClick={closeTeam}>Close Order</button>
                                                : <button type="button" className="cl-btn cl-btn--outline" disabled={busy} onClick={startTeam}>Start a New Order</button>
                                        ) : (
                                            teamOrder.status === 'OPEN' && <span className="cl-note">Only {teamOrder.initiatorName} can close this order and finalize it.</span>
                                        )}
                                        {teamOrder.mineInitiated && teamOrder.status === 'OPEN' && (
                                            <button type="button" className="cl-btn cl-btn--text" disabled={busy} onClick={() => cancelOrder('team')}>Cancel</button>
                                        )}
                                    </>}
                                />
                            )}
                        </div>

                        <div className="cl-history">
                            <h3 className="cl-history-title">Order History</h3>
                            {history.length === 0 ? (
                                <div className="cl-empty">No past orders yet.</div>
                            ) : history.map(h => (
                                <div key={h.id} className="cl-history-card">
                                    <div className="cl-history-head">
                                        <span className="cl-history-date">
                                            {fmtWhen(h.closedAt)}
                                            {h.orderType === 'TEAM' && <span className="cl-history-badge">Team · {h.teamName}</span>}
                                        </span>
                                        <span className="cl-history-total">${money(h.total)}</span>
                                    </div>
                                    {h.people.map(p => (
                                        <div key={p.email} className="cl-history-person">
                                            <div className="cl-history-person-name">{p.name}</div>
                                            {p.items.map(it => (
                                                <div key={it.id} className="cl-history-item">{it.qty}× {it.itemLabel}{it.detail ? ` — ${it.detail}` : ''}</div>
                                            ))}
                                        </div>
                                    ))}
                                    <button type="button" className="cl-btn cl-btn--outline" disabled={busy} onClick={() => doReorder(h.id)}>Order This Again</button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {wingsDraft && (
                <ItemConfigModal kind="wings" draft={wingsDraft} setDraft={setWingsDraft}
                    onCancel={() => setWingsDraft(null)} onConfirm={confirmWings} busy={busy} />
            )}
            {burgerDraft && (
                <ItemConfigModal kind="cheeseburger" draft={burgerDraft} setDraft={setBurgerDraft}
                    onCancel={() => setBurgerDraft(null)} onConfirm={confirmBurger} busy={busy} />
            )}
        </section>
    );
}

function OrderCard({ order, title, subtitle, closed, onAddItems, onChangeQty, onRemove, actions }) {
    return (
        <div className="cl-order-card">
            <div className="cl-order-card-head">
                <div>
                    <div className="cl-order-card-title">{title}{closed && <span className="cl-closed-badge">Closed</span>}</div>
                    {subtitle && <div className="cl-order-card-subtitle">{subtitle}</div>}
                </div>
                {onAddItems && <button type="button" className="cl-btn cl-btn--primary" onClick={onAddItems}>+ Add Items to {title}</button>}
            </div>
            <div className="cl-order-lines">
                {order.people.length === 0 && <div className="cl-empty">No items yet.</div>}
                {order.people.map(person => (
                    <div key={person.email} className="cl-person-group">
                        {order.orderType === 'TEAM' && (
                            <div className="cl-person-name">{person.name}{person.me && <span className="cl-me-tag"> (you)</span>}</div>
                        )}
                        {person.items.map(item => (
                            <div key={item.id} className="cl-line-item">
                                <span className="cl-line-label">{item.itemLabel}{item.detail ? ` — ${item.detail}` : ''}</span>
                                {item.mine && !closed ? (
                                    <div className="cl-line-qty">
                                        <button type="button" className="cl-line-qty-btn" onClick={() => onChangeQty(item, item.qty - 1)}>−</button>
                                        <span className="cl-line-qty-num">{item.qty}</span>
                                        <button type="button" className="cl-line-qty-btn" onClick={() => onChangeQty(item, item.qty + 1)}>+</button>
                                        <span className="cl-line-price">${money(item.lineTotal)}</span>
                                        <button type="button" className="cl-line-remove" onClick={() => onRemove(item)}>Remove</button>
                                    </div>
                                ) : (
                                    <div className="cl-line-qty cl-line-qty--readonly">
                                        <span className="cl-line-qty-num">{item.qty}×</span>
                                        <span className="cl-line-price">${money(item.lineTotal)}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {order.orderType === 'TEAM' && <div className="cl-person-subtotal">Subtotal: ${money(person.subtotal)}</div>}
                    </div>
                ))}
            </div>
            <div className="cl-order-total">TOTAL <b>${money(order.total)}</b></div>
            <div className="cl-order-actions">{actions}</div>
        </div>
    );
}

function MenuBuilder({ editingLabel, order, onDone, onAddPlain, onBumpPlain, onOpenWings, onOpenBurger, busy }) {
    const mine = order?.people?.find(p => p.me);
    const myPlainItem = (key) => mine?.items?.find(it => it.itemKey === key && !it.detail);
    const myCount = mine?.items?.length || 0;
    const myTotal = mine?.subtotal || 0;

    return (
        <div className="cl-builder">
            <div className="cl-builder-bar">
                <span>Adding items to: <b>{editingLabel}</b></span>
                <button type="button" className="cl-builder-done" onClick={onDone}>Done — View Orders →</button>
            </div>
            {MENU.map(section => (
                <div key={section.category} className="cl-menu-section">
                    <div className="cl-menu-section-title">{section.category.toUpperCase()}</div>
                    {section.items.map(item => {
                        if (item.configurable === 'wings') {
                            return (
                                <div key={item.key} className="cl-menu-row">
                                    <div>
                                        <div className="cl-menu-item-name">{item.label}</div>
                                        <div className="cl-menu-item-note">{item.note}</div>
                                    </div>
                                    <button type="button" className="cl-btn cl-btn--primary" disabled={busy} onClick={onOpenWings}>Add Wings</button>
                                </div>
                            );
                        }
                        if (item.configurable === 'cheeseburger') {
                            return (
                                <div key={item.key} className="cl-menu-row">
                                    <div className="cl-menu-item-name">{item.label}</div>
                                    <button type="button" className="cl-btn cl-btn--primary" disabled={busy} onClick={onOpenBurger}>Add Cheeseburger</button>
                                </div>
                            );
                        }
                        const existing = myPlainItem(item.key);
                        return (
                            <div key={item.key} className="cl-menu-row">
                                <div>
                                    <div className="cl-menu-item-name">{item.label}</div>
                                    <div className="cl-menu-item-note">${item.price.toFixed(2)}</div>
                                </div>
                                {existing ? (
                                    <div className="cl-menu-stepper">
                                        <button type="button" disabled={busy} onClick={() => onBumpPlain(existing, -1)}>−</button>
                                        <span>{existing.qty}</span>
                                        <button type="button" disabled={busy} onClick={() => onBumpPlain(existing, 1)}>+</button>
                                    </div>
                                ) : (
                                    <button type="button" className="cl-btn cl-btn--outline" disabled={busy} onClick={() => onAddPlain(item.key)}>Add</button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
            {myCount > 0 && (
                <div className="cl-sticky-cart">
                    <span><b>{myCount}</b> item(s) · <b className="cl-sticky-cart-total">${money(myTotal)}</b></span>
                    <button type="button" className="cl-btn cl-btn--primary" onClick={onDone}>Done — View Orders →</button>
                </div>
            )}
        </div>
    );
}

export default ChickenLicksSection;
