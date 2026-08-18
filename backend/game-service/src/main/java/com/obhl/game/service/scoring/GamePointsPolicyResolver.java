package com.obhl.game.service.scoring;

import java.util.List;

import org.springframework.stereotype.Service;

import com.obhl.game.model.Game;

import lombok.RequiredArgsConstructor;

/**
 * Picks the scoring rules for a game.
 *
 * <p>Spring injects every {@link GamePointsPolicy} bean, so a new set of rules is a new class and
 * nothing else. The policies are mutually exclusive on game type; if that ever stops being true,
 * the first match wins and the ambiguity is a bug in the policies rather than here.
 */
@Service
@RequiredArgsConstructor
public class GamePointsPolicyResolver {

    private final List<GamePointsPolicy> policies;

    public GamePointsPolicy forGame(Game game) {
        return policies.stream()
                .filter(p -> p.supports(game))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No points policy handles game type '" + game.getGameType() + "'"));
    }
}
