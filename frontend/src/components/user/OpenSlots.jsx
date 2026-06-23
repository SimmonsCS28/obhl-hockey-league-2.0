// v3 Phase 2 — Open Slots (ref/scorekeeper self sign-up). STUB: to be built by the v3-openslots session.
// Design: design_handoff_obhl_v3/OpenSlots.dc.html. Data: api.getOpenSlots(role, seasonId, week),
// api.signupForSlot(slotId), api.dropSlotSignup(slotId). See V3_PHASE2_HANDOFF.md.
const OpenSlots = () => {
    return (
        <div className="obi-container" style={{ padding: '2rem 0' }}>
            <h1 className="obi-page-title">Open Slots</h1>
            <p style={{ color: 'var(--obi-text-muted)' }}>Coming soon — self sign-up for referee &amp; scorekeeper shifts.</p>
        </div>
    );
};

export default OpenSlots;
