package com.obhl.game.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.game.dto.GameDto;
import com.obhl.game.model.Game;
import com.obhl.game.repository.GameRepository;
import com.obhl.game.service.schedule.TournamentScheduleGenerator;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameService {

    private final GameRepository gameRepository;
    private final com.obhl.game.service.scoring.GamePointsPolicyResolver pointsPolicyResolver;
    private final com.obhl.game.service.schedule.TournamentBracketService tournamentBracketService;
    private final TeamStatsUpdater teamStatsUpdater;
    private final PlayerStatsAggregator playerStatsAggregator;

    @Transactional(readOnly = true)
    public List<GameDto.Response> getAllGames() {
        return gameRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGamesBySeason(Long seasonId) {
        return gameRepository.findBySeasonIdOrderByGameDate(seasonId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGamesBySeasonAndTeam(Long seasonId, Long teamId) {
        return gameRepository.findBySeasonIdAndTeam(seasonId, teamId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGamesByStatus(String status) {
        return gameRepository.findByStatus(status)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGamesByTeam(Long teamId) {
        return gameRepository.findByHomeTeamIdOrAwayTeamId(teamId, teamId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<GameDto.Response> getGameById(Long id) {
        return gameRepository.findById(id).map(this::toResponse);
    }

    @Transactional
    public GameDto.Response createGame(GameDto.Create dto) {
        Game game = new Game();
        game.setSeasonId(dto.getSeasonId());
        game.setLeagueId(dto.getLeagueId());
        game.setHomeTeamId(dto.getHomeTeamId());
        game.setAwayTeamId(dto.getAwayTeamId());
        game.setGameDate(dto.getGameDate());
        game.setVenue(dto.getVenue());
        game.setStatus(dto.getStatus());
        game.setHomeScore(dto.getHomeScore());
        game.setAwayScore(dto.getAwayScore());
        game.setOvertime(dto.getOvertime());
        game.setShootout(dto.getShootout());
        game.setPeriod(dto.getPeriod());
        game.setWeek(dto.getWeek());
        game.setRink(dto.getRink());
        game.setGameNotes(dto.getGameNotes());
        // Preserve playoff type — default to REGULAR_SEASON if not specified
        game.setGameType(dto.getGameType() != null ? dto.getGameType() : "REGULAR_SEASON");
        game.setPlayoffRound(dto.getPlayoffRound());
        game.setBracketPosition(dto.getBracketPosition());
        game.setGoalie1Id(dto.getGoalie1Id());
        game.setGoalie2Id(dto.getGoalie2Id());
        game.setReferee1Id(dto.getReferee1Id());
        game.setReferee2Id(dto.getReferee2Id());
        game.setScorekeeperId(dto.getScorekeeperId());

        return toResponse(gameRepository.save(game));
    }

    @Transactional
    public GameDto.Response updateGame(Long id, GameDto.Update dto) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (dto.getSeasonId() != null)
            game.setSeasonId(dto.getSeasonId());
        if (dto.getLeagueId() != null)
            game.setLeagueId(dto.getLeagueId());
        if (dto.getHomeTeamId() != null)
            game.setHomeTeamId(dto.getHomeTeamId());
        if (dto.getAwayTeamId() != null)
            game.setAwayTeamId(dto.getAwayTeamId());
        if (dto.getGameDate() != null)
            game.setGameDate(dto.getGameDate());
        if (dto.getVenue() != null)
            game.setVenue(dto.getVenue());
        if (dto.getStatus() != null)
            game.setStatus(dto.getStatus());
        if (dto.getHomeScore() != null)
            game.setHomeScore(dto.getHomeScore());
        if (dto.getAwayScore() != null)
            game.setAwayScore(dto.getAwayScore());
        if (dto.getOvertime() != null)
            game.setOvertime(dto.getOvertime());
        if (dto.getShootout() != null)
            game.setShootout(dto.getShootout());
        if (dto.getPeriod() != null)
            game.setPeriod(dto.getPeriod());
        if (dto.getWeek() != null)
            game.setWeek(dto.getWeek());
        if (dto.getRink() != null)
            game.setRink(dto.getRink());
        if (dto.getGameNotes() != null)
            game.setGameNotes(dto.getGameNotes());
        if (dto.getGameType() != null)
            game.setGameType(dto.getGameType());
        if (dto.getPlayoffRound() != null)
            game.setPlayoffRound(dto.getPlayoffRound());
        if (dto.getBracketPosition() != null)
            game.setBracketPosition(dto.getBracketPosition());
        if (dto.getGoalie1Id() != null)
            game.setGoalie1Id(dto.getGoalie1Id() == -1 ? null : dto.getGoalie1Id());
        if (dto.getGoalie2Id() != null)
            game.setGoalie2Id(dto.getGoalie2Id() == -1 ? null : dto.getGoalie2Id());
        if (dto.getReferee1Id() != null)
            game.setReferee1Id(dto.getReferee1Id() == -1 ? null : dto.getReferee1Id());
        if (dto.getReferee2Id() != null)
            game.setReferee2Id(dto.getReferee2Id() == -1 ? null : dto.getReferee2Id());
        if (dto.getScorekeeperId() != null)
            game.setScorekeeperId(dto.getScorekeeperId() == -1 ? null : dto.getScorekeeperId());

        return toResponse(gameRepository.save(game));
    }

    @Transactional
    public void deleteGame(Long id) {
        gameRepository.deleteById(id);
    }

    @Transactional
    public GameDto.Response updateGameScore(Long id, GameDto.ScoreUpdate scoreUpdate) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        game.setHomeScore(scoreUpdate.getHomeScore());
        game.setAwayScore(scoreUpdate.getAwayScore());
        if (scoreUpdate.getPeriod() != null) {
            game.setPeriod(scoreUpdate.getPeriod());
        }

        // Auto-set status to in_progress when scores are updated (unless finalized)
        if (!"completed".equals(game.getStatus())) {
            game.setStatus("in_progress");
        }

        return toResponse(gameRepository.save(game));
    }

    @Transactional
    public GameDto.Response startGame(Long id) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        // Idempotent: only scheduled games actually transition. Already-live or
        // completed games are returned as-is so a double-click can't error out.
        if ("scheduled".equals(game.getStatus())) {
            game.setStatus("in_progress");
            game = gameRepository.save(game);
        }

        return toResponse(game);
    }

    @Transactional
    public GameDto.Response finalizeGame(Long id, GameDto.FinalizeRequest finalizeRequest) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        Long forfeitTeamId = finalizeRequest.getForfeitTeamId();
        if (forfeitTeamId != null && !forfeitTeamId.equals(game.getHomeTeamId())
                && !forfeitTeamId.equals(game.getAwayTeamId())) {
            throw new RuntimeException("Forfeiting team must be the home or away team for this game");
        }

        if (forfeitTeamId != null) {
            // Standard forfeit score: the non-forfeiting team is recorded as the 1-0 winner
            boolean homeForfeited = forfeitTeamId.equals(game.getHomeTeamId());
            game.setHomeScore(homeForfeited ? 0 : 1);
            game.setAwayScore(homeForfeited ? 1 : 0);
            game.setEndedInOT(false);
        } else {
            game.setHomeScore(finalizeRequest.getHomeScore());
            game.setAwayScore(finalizeRequest.getAwayScore());
            game.setEndedInOT(finalizeRequest.getEndedInOT());
        }
        game.setForfeitTeamId(forfeitTeamId);
        game.setStatus("completed");

        // League and tournament games score differently; the resolver picks. For league games this
        // still lands in PointsCalculator, unchanged.
        pointsPolicyResolver.forGame(game).apply(game);

        // Save game first
        Game savedGame = gameRepository.save(game);

        // Update team standings (skips PLAYOFF games automatically)
        teamStatsUpdater.updateTeamStats(savedGame);

        // Aggregate and update player stats — skipped for forfeits since the game wasn't actually played
        if (forfeitTeamId == null) {
            playerStatsAggregator.aggregateAndUpdateStats(savedGame);
        }

        // Re-seed the next playoff round, once this game's round is finished
        if ("PLAYOFF".equals(savedGame.getGameType())) {
            reseedNextRound(savedGame);
        }

        // Tournaments have their own advancement: arbitrary round names, a placement game fed by
        // the semifinal LOSERS, and a bracket that is seeded from group standings rather than
        // known up front. Kept separate so the league playoff path above is untouched.
        if ("TOURNAMENT".equals(savedGame.getGameType())) {
            tournamentBracketService.onGameFinalized(savedGame);
        }

        return toResponse(savedGame);
    }

    @Transactional
    public GameDto.Response unfinalizeGame(Long id) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (!"completed".equals(game.getStatus())) {
            throw new RuntimeException("Game is not completed");
        }

        // Revert stats first using the OLD completed values
        teamStatsUpdater.revertTeamStats(game);
        if (game.getForfeitTeamId() == null) {
            playerStatsAggregator.revertPlayerStats(game);
        }

        // Reset points and status
        game.setHomeTeamPoints(0);
        game.setAwayTeamPoints(0);
        // Leave scores as is, so they can be edited or left alone.
        // Deliberately "scheduled", not "in_progress" — an unfinalized game shouldn't
        // show as live on the public schedule until someone actively resumes scoring it
        // (adding/editing an event or saving a score sets it back to in_progress then).
        game.setStatus("scheduled");

        return toResponse(gameRepository.save(game));
    }

    @Transactional
    public GameDto.Response revertToScheduled(Long id) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (!"in_progress".equals(game.getStatus())) {
            throw new RuntimeException("Game must be In Progress to revert to Scheduled");
        }

        // Leave scores/events as is, so they can be edited or left alone
        game.setStatus("scheduled");

        return toResponse(gameRepository.save(game));
    }

    private GameDto.Response toResponse(Game game) {
        GameDto.Response dto = new GameDto.Response();
        dto.setId(game.getId());
        dto.setSeasonId(game.getSeasonId());
        dto.setLeagueId(game.getLeagueId());
        dto.setHomeTeamId(game.getHomeTeamId());
        dto.setAwayTeamId(game.getAwayTeamId());
        dto.setGameDate(game.getGameDate());
        dto.setVenue(game.getVenue());
        dto.setStatus(game.getStatus());
        dto.setHomeScore(game.getHomeScore());
        dto.setAwayScore(game.getAwayScore());
        dto.setOvertime(game.getOvertime());
        dto.setShootout(game.getShootout());
        dto.setPeriod(game.getPeriod());
        dto.setEndedInOT(game.getEndedInOT());
        dto.setForfeitTeamId(game.getForfeitTeamId());
        dto.setHomeTeamPoints(game.getHomeTeamPoints());
        dto.setAwayTeamPoints(game.getAwayTeamPoints());
        dto.setWeek(game.getWeek());
        dto.setRink(game.getRink());
        dto.setGameNotes(game.getGameNotes());
        dto.setGameType(game.getGameType());
        dto.setPlayoffRound(game.getPlayoffRound());
        dto.setTournamentStage(game.getTournamentStage());
        dto.setPeriodCount(game.getPeriodCount());
        dto.setPeriodMinutes(game.getPeriodMinutes());
        dto.setBracketPosition(game.getBracketPosition());
        dto.setHomeSeed(game.getHomeSeed());
        dto.setAwaySeed(game.getAwaySeed());
        dto.setGoalie1Id(game.getGoalie1Id());
        dto.setGoalie2Id(game.getGoalie2Id());
        dto.setReferee1Id(game.getReferee1Id());
        dto.setReferee2Id(game.getReferee2Id());
        dto.setScorekeeperId(game.getScorekeeperId());
        dto.setCreatedAt(game.getCreatedAt());
        dto.setUpdatedAt(game.getUpdatedAt());
        return dto;
    }



    // -------------------------------------------------------------------------
    // Playoff Bracket Methods
    // -------------------------------------------------------------------------

    /** Only the top 8 teams make the playoffs; everyone else plays consolation games. */
    private static final int MAX_BRACKET_TEAMS = 8;

    /**
     * Seed the playoffs from an ordered standings list (seed 1 = best record first).
     *
     * <p>A playoff week has a slot for every team, but only some of those games are actual
     * bracket games. With 10 teams the first playoff week is four quarterfinals plus one
     * consolation game; the next week is two semifinals, then one final. A game is a bracket
     * game if and only if {@code playoff_round} is set — consolation games have it cleared,
     * which is also what keeps them out of the bracket display and the goalie auto-proposer.
     *
     * <p>First-round matchups follow standard bracket ordering — position 1 is 1v8, then 4v5, 2v7,
     * 3v6 — so the two best seeds sit in opposite halves and can only meet in the final. Laying
     * them out in plain seed order (1v8, 2v7, 3v6, 4v5) reads more naturally but is wrong: with
     * position P feeding ceil(P/2), it puts seeds 1 and 2 in the same semifinal.
     *
     * <p>Each participant's seed is recorded on the game so later rounds can be re-seeded without
     * recomputing standings. The better seed always takes the home slot.
     *
     * <p>Later rounds are pre-designated to the earliest slots as a sensible default so winners
     * have somewhere to advance to; the coordinator can move them with
     * {@link #designateBracketSlot}.
     */
    @Transactional
    public List<GameDto.Response> initializePlayoffBracket(Long seasonId, List<Long> seededTeamIds) {
        List<Game> allPlayoffGames = gameRepository.findBySeasonId(seasonId).stream()
                .filter(g -> "PLAYOFF".equals(g.getGameType()))
                .sorted(Comparator.comparingInt(Game::getWeek)
                        .thenComparing(Game::getGameDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        if (allPlayoffGames.isEmpty()) {
            throw new RuntimeException("No playoff games found for season " + seasonId);
        }

        // Playoff weeks in order: [0] = first round, [1] = next, ...
        List<Integer> playoffWeeks = allPlayoffGames.stream()
                .map(Game::getWeek).distinct().sorted().toList();

        // Bracket size: top 8, or the largest power of two that fits a smaller league.
        int bracketTeams = largestPowerOfTwo(Math.min(MAX_BRACKET_TEAMS, seededTeamIds.size()));
        if (bracketTeams < 2) {
            throw new RuntimeException("Not enough teams to seed a playoff bracket");
        }

        List<Game> updated = new ArrayList<>();

        // --- Round 1: seed the bracket games, then pair the non-qualifiers into consolation ---
        int firstWeek = playoffWeeks.get(0);
        List<Game> firstRoundSlots = gamesInWeek(allPlayoffGames, firstWeek);
        int roundGames = bracketTeams / 2;

        List<Integer> bracketOrder = TournamentScheduleGenerator.seedOrder(bracketTeams);

        for (int i = 0; i < firstRoundSlots.size(); i++) {
            Game g = firstRoundSlots.get(i);
            if (i < roundGames) {
                // Consecutive pairs of the standard ordering are the matchups; better seed at home.
                int a = bracketOrder.get(i * 2);
                int b = bracketOrder.get(i * 2 + 1);
                int homeSeed = Math.min(a, b);
                int awaySeed = Math.max(a, b);

                g.setPlayoffRound(roundNameFor(playoffWeeks.size(), 0));
                g.setBracketPosition(i + 1);
                setParticipants(g, seededTeamIds.get(homeSeed - 1), homeSeed,
                        seededTeamIds.get(awaySeed - 1), awaySeed);
            } else {
                // Consolation: the teams that missed the cut, paired off in standings order.
                int leftoverIdx = bracketTeams + (i - roundGames) * 2;
                clearBracketRole(g);
                g.setHomeTeamId(seededTeamIds.size() > leftoverIdx ? seededTeamIds.get(leftoverIdx) : null);
                g.setAwayTeamId(seededTeamIds.size() > leftoverIdx + 1 ? seededTeamIds.get(leftoverIdx + 1) : null);
                g.setHomeSeed(null);
                g.setAwaySeed(null);
            }
            updated.add(gameRepository.save(g));
        }

        // --- Later rounds: designate the right number of slots, teams TBD until winners advance ---
        for (int r = 1; r < playoffWeeks.size(); r++) {
            int weekGames = roundGames >> r;   // 4 quarterfinals -> 2 semifinals -> 1 final
            if (weekGames < 1) {
                break;
            }
            List<Game> slots = gamesInWeek(allPlayoffGames, playoffWeeks.get(r));
            for (int i = 0; i < slots.size(); i++) {
                Game g = slots.get(i);
                if (i < weekGames) {
                    g.setPlayoffRound(roundNameFor(playoffWeeks.size(), r));
                    g.setBracketPosition(i + 1);
                } else {
                    clearBracketRole(g);
                }
                g.setHomeTeamId(null);   // decided when the previous round is re-seeded
                g.setAwayTeamId(null);
                g.setHomeSeed(null);
                g.setAwaySeed(null);
                updated.add(gameRepository.save(g));
            }
        }

        log.info("Seeded playoff bracket for season {}: {} bracket teams, {} first-round games",
                seasonId, bracketTeams, roundGames);
        return updated.stream().map(this::toResponse).collect(Collectors.toList());
    }

    /**
     * Make a playoff game a bracket game at the given round/position, or a consolation game
     * when {@code round} is blank. Lets the coordinator choose which slots host the semifinals
     * and final — they're often moved to the best times for the teams involved.
     */
    @Transactional
    public GameDto.Response designateBracketSlot(Long gameId, String round, Integer position) {
        Game g = gameRepository.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Game not found: " + gameId));
        if (!"PLAYOFF".equals(g.getGameType())) {
            throw new RuntimeException("Only playoff-week games can be designated");
        }
        if (round == null || round.isBlank()) {
            // Demoting a bracket slot to consolation would leave the round a game short, so hand
            // its role to a consolation slot in the same week instead. The round always keeps
            // exactly its required number of games (4 QF / 2 SF / 1 final).
            String vacatedRound = g.getPlayoffRound();
            Integer vacatedPos = g.getBracketPosition();
            if (vacatedRound != null) {
                gameRepository.findBySeasonId(g.getSeasonId()).stream()
                        .filter(o -> !o.getId().equals(g.getId()))
                        .filter(o -> java.util.Objects.equals(o.getWeek(), g.getWeek()))
                        .filter(o -> "PLAYOFF".equals(o.getGameType()) && o.getPlayoffRound() == null)
                        .findFirst()
                        .ifPresent(other -> {
                            other.setPlayoffRound(vacatedRound);
                            other.setBracketPosition(vacatedPos);
                            gameRepository.save(other);
                        });
            }
            clearBracketRole(g);
            return toResponse(gameRepository.save(g));
        }

        String r = round.trim().toUpperCase();
        if (!r.equals("QUARTERFINAL") && !r.equals("SEMIFINAL") && !r.equals("FINAL")) {
            throw new RuntimeException("Unsupported playoff round: " + round);
        }
        int pos = position == null ? 1 : position;

        // A bracket position may only be held by one slot. If another slot in this week already
        // holds it, SWAP the two roles rather than duplicating — a duplicate would leave the week
        // with the wrong number of bracket games, and advancement (which resolves a winner's next
        // game by round+position) would place them into an arbitrary one of the two.
        String priorRound = g.getPlayoffRound();
        Integer priorPos = g.getBracketPosition();

        gameRepository.findBySeasonId(g.getSeasonId()).stream()
                .filter(o -> !o.getId().equals(g.getId()))
                .filter(o -> java.util.Objects.equals(o.getWeek(), g.getWeek()))
                .filter(o -> r.equals(o.getPlayoffRound())
                        && o.getBracketPosition() != null && o.getBracketPosition() == pos)
                .findFirst()
                .ifPresent(other -> {
                    other.setPlayoffRound(priorRound);       // may be null -> becomes consolation
                    other.setBracketPosition(priorRound == null ? null : priorPos);
                    gameRepository.save(other);
                });

        g.setPlayoffRound(r);
        g.setBracketPosition(pos);
        return toResponse(gameRepository.save(g));
    }

    /** Consolation games keep gameType PLAYOFF (they're in a playoff week) but hold no bracket role. */
    private void clearBracketRole(Game g) {
        g.setPlayoffRound(null);
        g.setBracketPosition(null);
    }

    private List<Game> gamesInWeek(List<Game> games, int week) {
        return games.stream()
                .filter(g -> g.getWeek() != null && g.getWeek() == week)
                .sorted(Comparator.comparing(Game::getGameDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    /** With 3 playoff weeks the rounds run QUARTERFINAL, SEMIFINAL, FINAL; fewer weeks start later. */
    private String roundNameFor(int totalPlayoffWeeks, int weekIndex) {
        String[] all = { "QUARTERFINAL", "SEMIFINAL", "FINAL" };
        int start = Math.max(0, all.length - totalPlayoffWeeks);
        int idx = start + weekIndex;
        return idx < all.length ? all[idx] : "FINAL";
    }

    private static int largestPowerOfTwo(int n) {
        int p = 1;
        while (p * 2 <= n) {
            p *= 2;
        }
        return p;
    }

    private static String nextPlayoffRound(String round) {
        return switch (round == null ? "" : round) {
            case "QUARTERFINAL" -> "SEMIFINAL";
            case "SEMIFINAL"    -> "FINAL";
            default             -> null;   // FINAL has nowhere to go
        };
    }

    private List<Game> bracketRound(List<Game> playoffGames, String round) {
        return playoffGames.stream()
                .filter(g -> round.equals(g.getPlayoffRound()) && g.getBracketPosition() != null)
                .sorted(Comparator.comparingInt(Game::getBracketPosition))
                .toList();
    }

    /** Ties are not possible in an elimination game; if one is entered anyway, home advances. */
    private Long bracketWinner(Game g) {
        if (g.getHomeTeamId() == null || g.getAwayTeamId() == null) return null;
        if (g.getHomeScore() == null || g.getAwayScore() == null) return null;
        return g.getHomeScore() >= g.getAwayScore() ? g.getHomeTeamId() : g.getAwayTeamId();
    }

    private void setParticipants(Game g, Long homeTeamId, Integer homeSeed,
                                 Long awayTeamId, Integer awaySeed) {
        g.setHomeTeamId(homeTeamId);
        g.setHomeSeed(homeSeed);
        g.setAwayTeamId(awayTeamId);
        g.setAwaySeed(awaySeed);
    }

    /**
     * Seed of every team in this season's bracket, taken from the games they have already played.
     *
     * <p>Empty when the bracket predates the seed columns and migration 057's backfill did not
     * reach it — {@link #reseedNextRound} treats that as a reason to fall back rather than guess.
     */
    private Map<Long, Integer> playoffSeeds(List<Game> playoffGames) {
        Map<Long, Integer> seeds = new HashMap<>();
        for (Game g : playoffGames) {
            if (g.getPlayoffRound() == null) continue;   // consolation games carry no seed
            if (g.getHomeTeamId() != null && g.getHomeSeed() != null) {
                seeds.putIfAbsent(g.getHomeTeamId(), g.getHomeSeed());
            }
            if (g.getAwayTeamId() != null && g.getAwaySeed() != null) {
                seeds.putIfAbsent(g.getAwayTeamId(), g.getAwaySeed());
            }
        }
        return seeds;
    }

    /**
     * Re-seed the next playoff round once the current one is complete.
     *
     * <p>Survivors are re-ranked by their original seed and paired best against worst — with four
     * teams left, the top seed plays the lowest surviving seed rather than whoever happened to sit
     * in the adjacent bracket position. The better seed always takes the home slot, in every round
     * including the final.
     *
     * <p>Two things follow from re-seeding that the old positional advancement did not have to
     * care about:
     * <ul>
     *   <li><b>It waits for the whole round.</b> A matchup cannot be known from one result — the
     *       last quarterfinal decides who the top seed plays. Until the round is finished the next
     *       round's slots stay TBD.</li>
     *   <li><b>It will not move a matchup that has already started.</b> If a game in the next round
     *       is under way or finished, the pairing stands; the alternative is silently reassigning a
     *       game someone is in the middle of scoring.</li>
     * </ul>
     *
     * <p>If seeds are missing the bracket cannot be re-seeded, and it falls back to the original
     * fixed-tree advancement rather than inventing an order.
     */
    // Package-private so PlayoffReseedingTest can drive it without standing up finalizeGame's
    // stats and scoring collaborators.
    void reseedNextRound(Game completedGame) {
        String currentRound = completedGame.getPlayoffRound();
        String nextRound = nextPlayoffRound(currentRound);
        if (nextRound == null || completedGame.getBracketPosition() == null) return;

        List<Game> playoffGames = gameRepository.findBySeasonId(completedGame.getSeasonId()).stream()
                .filter(g -> "PLAYOFF".equals(g.getGameType()))
                .toList();

        List<Game> current = bracketRound(playoffGames, currentRound);
        List<Game> next = bracketRound(playoffGames, nextRound);
        if (current.isEmpty() || next.isEmpty()) return;

        if (current.stream().anyMatch(g -> !"completed".equals(g.getStatus()))) {
            log.info("{} not complete yet; {} stays TBD", currentRound, nextRound);
            return;
        }

        List<Game> started = next.stream()
                .filter(g -> !"scheduled".equals(g.getStatus()))
                .toList();
        if (!started.isEmpty()) {
            log.warn("Not re-seeding {} for season {}: {} game(s) already in progress or completed",
                    nextRound, completedGame.getSeasonId(), started.size());
            return;
        }

        Map<Long, Integer> seeds = playoffSeeds(playoffGames);

        List<Long> survivors = current.stream()
                .map(this::bracketWinner)
                .filter(Objects::nonNull)
                .distinct()
                .sorted(Comparator.comparingInt(id -> seeds.getOrDefault(id, Integer.MAX_VALUE)))
                .collect(Collectors.toList());

        boolean seedsKnown = survivors.stream().allMatch(seeds::containsKey);
        if (!seedsKnown || survivors.size() != next.size() * 2) {
            log.warn("Cannot re-seed {} for season {} ({} survivor(s), {} slot(s), seeds known: {})"
                            + " — falling back to fixed bracket advancement",
                    nextRound, completedGame.getSeasonId(), survivors.size(), next.size(), seedsKnown);
            // The whole round, not just this game: the earlier results were held back by the
            // round-complete check above and have not been advanced anywhere yet.
            for (Game played : current) {
                advanceFixedBracket(played, currentRound, nextRound, next);
            }
            return;
        }

        for (int i = 0; i < next.size(); i++) {
            Long better = survivors.get(i);
            Long worse = survivors.get(survivors.size() - 1 - i);
            Game slot = next.get(i);
            setParticipants(slot, better, seeds.get(better), worse, seeds.get(worse));
            gameRepository.save(slot);
            log.info("Re-seeded {} pos {}: seed {} (home) vs seed {}",
                    nextRound, slot.getBracketPosition(), seeds.get(better), seeds.get(worse));
        }
    }

    /**
     * The pre-re-seeding behaviour, kept as a fallback for a bracket whose seeds are unknown.
     *
     * <p>Position P feeds ceil(P/2) of the next round; odd positions take the home slot. Correct
     * as far as it goes, but it cannot honour seeding — home is decided by which slot fed it.
     */
    private void advanceFixedBracket(Game completedGame, String currentRound, String nextRound,
                                     List<Game> nextRoundGames) {
        Long winnerId = bracketWinner(completedGame);
        if (winnerId == null) return;

        int currentPos = completedGame.getBracketPosition();
        int nextPos = (currentPos + 1) / 2;
        boolean isHomeSlot = (currentPos % 2 == 1);

        nextRoundGames.stream()
                .filter(g -> g.getBracketPosition() == nextPos)
                .findFirst()
                .ifPresent(nextGame -> {
                    if (isHomeSlot) {
                        nextGame.setHomeTeamId(winnerId);
                    } else {
                        nextGame.setAwayTeamId(winnerId);
                    }
                    gameRepository.save(nextGame);
                    log.info("Advanced bracket: {} winner {} → {} pos {} slot {}",
                            currentRound, winnerId, nextRound, nextPos,
                            isHomeSlot ? "home" : "away");
                });
    }

    @Transactional(readOnly = true)
    public List<com.obhl.game.dto.GameDayDTO> getGameDaysBySeason(Long seasonId) {
        java.time.ZoneId utcZone = java.time.ZoneId.of("UTC");
        java.time.ZoneId centralZone = java.time.ZoneId.of("America/Chicago");

        java.util.Map<java.time.LocalDate, Long> gamesPerDay = gameRepository.findBySeasonIdOrderByGameDate(seasonId)
                .stream()
                .collect(Collectors.groupingBy(
                        game -> game.getGameDate().atZone(utcZone).withZoneSameInstant(centralZone).toLocalDate(),
                        Collectors.counting()));

        return gamesPerDay.entrySet().stream()
                .map(entry -> new com.obhl.game.dto.GameDayDTO(entry.getKey(), entry.getValue().intValue()))
                .sorted(java.util.Comparator.comparing(com.obhl.game.dto.GameDayDTO::getDate))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getGoalieAssignments(Long userId) {
        return gameRepository.findByGoalie1IdOrGoalie2Id(userId, userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getRefereeAssignments(Long userId) {
        return gameRepository.findByReferee1IdOrReferee2Id(userId, userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getScorekeeperAssignments(Long userId) {
        return gameRepository.findByScorekeeperId(userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getAvailableRefereeGames(Long seasonId) {
        return gameRepository.findBySeasonIdOrderByGameDate(seasonId)
                .stream()
                .filter(game -> game.getReferee1Id() == null || game.getReferee2Id() == null)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameDto.Response> getAvailableScorekeeperGames(Long seasonId) {
        return gameRepository.findBySeasonIdOrderByGameDate(seasonId)
                .stream()
                .filter(game -> game.getScorekeeperId() == null)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void assignReferee(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (game.getReferee1Id() == null) {
            game.setReferee1Id(userId);
        } else if (game.getReferee2Id() == null) {
            game.setReferee2Id(userId);
        } else {
            throw new RuntimeException("Game already has two referees assigned");
        }

        gameRepository.save(game);
    }

    @Transactional
    public void removeReferee(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (userId.equals(game.getReferee1Id())) {
            game.setReferee1Id(null);
        } else if (userId.equals(game.getReferee2Id())) {
            game.setReferee2Id(null);
        }

        gameRepository.save(game);
    }

    @Transactional
    public void assignScorekeeper(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (game.getScorekeeperId() != null) {
            throw new RuntimeException("Game already has a scorekeeper assigned");
        }

        game.setScorekeeperId(userId);
        gameRepository.save(game);
    }

    @Transactional
    public void removeScorekeeper(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new RuntimeException("Game not found"));

        if (userId.equals(game.getScorekeeperId())) {
            game.setScorekeeperId(null);
        }

        gameRepository.save(game);
    }
}
