package com.obhl.game.service.scoring;

import com.obhl.game.model.Game;

/**
 * Sets homeTeamPoints/awayTeamPoints on a finalized game.
 *
 * <p>Exists so league and tournament scoring can differ without {@code finalizeGame} knowing how.
 * The league awards 2/1/0 over three periods; the Conley Classic awards 3/1/0 plus per-period
 * bonuses over two, and only for group-stage games. Adding a third set of rules should mean adding
 * an implementation, not another branch in the finalize path.
 */
public interface GamePointsPolicy {

    boolean supports(Game game);

    void apply(Game game);
}
