import { Link } from 'react-router-dom';
import { useTournament } from './useTournament';
import { useTournamentRules } from './tournamentData';
import './TournamentPages.css';

/**
 * Tournament rules, layered on top of the standard OBHL rulebook.
 *
 * Sections are content-managed per tournament, because these rules follow the format: the overtime
 * and tiebreaker rules for a round-robin year are not the ones for a bracket year. Until any are
 * written the page still states the rules the code actually enforces, which are known from the
 * tournament's own configuration.
 */
function TournamentRules() {
    const { tournament } = useTournament();
    const { sections, loading } = useTournamentRules(tournament.slug);

    return (
        <>
            <div className="tcc-head">
                <div className="tcc-head-inner">
                    <div className="tcc-eyebrow">Classic Rules</div>
                    <h1 className="tcc-h1">Tournament Rules</h1>
                    <p className="tcc-sub">
                        These apply for Classic weekend on top of the standard OBHL rulebook. When in
                        doubt, the standard rules govern.
                    </p>
                </div>
            </div>

            <div className="tcc-rules">
                {loading && <div className="tcc-empty">Loading rules…</div>}

                {!loading && sections.length > 0 && sections.map(s => (
                    <article key={s.id} className="tcc-rulecard">
                        <h2 className="tcc-rulecard-title">{s.title}</h2>
                        {/* Content is authored by admins through the rules editor, same as league rules. */}
                        <div
                            className="tcc-rulecard-body"
                            dangerouslySetInnerHTML={{ __html: s.content }}
                        />
                    </article>
                ))}

                {!loading && sections.length === 0 && <DerivedRules tournament={tournament} />}

                <Link to="/rules" className="tcc-rules-out">Full OBHL Rulebook ↗</Link>
            </div>
        </>
    );
}

/**
 * What the system actually enforces, derived from the tournament's configuration. Shown until
 * someone writes the real rules, so the page is never simply blank — and so the scoring described
 * here cannot drift from the scoring the code applies.
 */
function DerivedRules({ tournament }) {
    const t = tournament;
    const groupPlay = t.groupStage !== 'NONE';

    return (
        <>
            <div className="tcc-rules-note">
                Rules for this year haven&rsquo;t been published yet. In the meantime, here is what the
                scoring system is set up to do.
            </div>

            <article className="tcc-rulecard">
                <h2 className="tcc-rulecard-title">Game Length &amp; Overtime</h2>
                <ul className="tcc-rulecard-list">
                    <li>{t.periodCount} periods of {t.periodMinutes} minutes.</li>
                    <li>Group-stage games may end in a tie — there is no overtime.</li>
                    <li>Elimination games go to sudden-death overtime; somebody has to advance.</li>
                </ul>
            </article>

            {groupPlay && (
                <article className="tcc-rulecard">
                    <h2 className="tcc-rulecard-title">Points</h2>
                    <ul className="tcc-rulecard-list">
                        <li><b>3 points</b> for a win, <b>1 point each</b> for a tie, none for a loss.</li>
                        <li><b>+1 point</b> for each period a team wins outright — more goals than the
                            opponent in that period. A tied period awards neither team.</li>
                        <li><b>+1 point</b> for each period a team takes no penalties in. Both teams can
                            earn this in the same period.</li>
                        <li><b>−1 point</b> for a team taking seven or more penalties in a game.</li>
                        <li>Maximum {(3 + t.periodCount * 2)} points in a game.</li>
                        <li>Only group-stage games award points. Bracket, placement and consolation
                            games decide placing, not standings.</li>
                    </ul>
                </article>
            )}

            {groupPlay && (
                <article className="tcc-rulecard">
                    <h2 className="tcc-rulecard-title">Tiebreakers</h2>
                    <ul className="tcc-rulecard-list">
                        <li>Head-to-head result.</li>
                        <li>Goal differential.</li>
                        <li>Fewest penalty minutes.</li>
                        <li>Coin flip.</li>
                    </ul>
                </article>
            )}

            <article className="tcc-rulecard">
                <h2 className="tcc-rulecard-title">Rosters &amp; Eligibility</h2>
                <ul className="tcc-rulecard-list">
                    <li>Teams are drafted fresh for the Classic each year and have no relationship to
                        regular-season teams, rosters, standings or records.</li>
                    <li>Goalies are assigned rather than drafted, and may swap benches at the half.</li>
                </ul>
            </article>

            <article className="tcc-rulecard">
                <h2 className="tcc-rulecard-title">Chocolate Milk Player of the Game</h2>
                <ul className="tcc-rulecard-list">
                    <li>After every game, each team&rsquo;s captain names one player from the opposing
                        bench who showed the best sportsmanship.</li>
                    <li>A carton of chocolate milk is delivered to that player&rsquo;s locker room — the
                        tournament&rsquo;s signature award.</li>
                </ul>
            </article>
        </>
    );
}

export default TournamentRules;
