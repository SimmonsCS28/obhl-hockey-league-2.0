import { longDate, duration, seasonStatusMeta } from '../../utils/seasonStats';
import './SeasonOverviewCards.css';

// The 4-card season overview row (Status / Start Date / End Date / Duration).
// Shared by the Home "Season at a Glance" section and the Seasons page details panel
// so the two stay identical.
function SeasonOverviewCards({ season }) {
    if (!season) return null;
    const st = seasonStatusMeta(season.status);

    return (
        <div className="obi-season-ov">
            <div className="obi-season-ov-card">
                <div className="obi-season-ov-label">Status</div>
                <span className={`obi-season-ov-status is-${st.mod}`}>
                    <span className="obi-season-ov-status-dot" />{st.label}
                </span>
            </div>
            <div className="obi-season-ov-card">
                <div className="obi-season-ov-label">Start Date</div>
                <div className="obi-season-ov-val">{longDate(season.startDate)}</div>
            </div>
            <div className="obi-season-ov-card">
                <div className="obi-season-ov-label">End Date</div>
                <div className="obi-season-ov-val">{longDate(season.endDate)}</div>
            </div>
            <div className="obi-season-ov-card obi-season-ov-card--accent">
                <div className="obi-season-ov-label">Duration</div>
                <div className="obi-season-ov-val">{duration(season.startDate, season.endDate)}</div>
            </div>
        </div>
    );
}

export default SeasonOverviewCards;
