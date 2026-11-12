package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.*;
import java.util.UUID;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class SeasonRecapServiceTest {
    JdbcTemplate db;
    SeasonRecapService service;
    @BeforeEach void setup() {
        db = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        db.execute("CREATE TABLE seasons(id bigint PRIMARY KEY, status varchar)");
        db.execute("CREATE TABLE teams(id bigint PRIMARY KEY, name varchar)");
        db.execute("CREATE TABLE games(id bigint PRIMARY KEY, season_id bigint, home_team_id bigint, away_team_id bigint, home_score int, away_score int, game_date timestamp, status varchar, game_type varchar, playoff_round varchar, forfeit_team_id bigint, ended_in_ot boolean, overtime boolean)");
        db.execute("CREATE TABLE game_events(game_id bigint, event_type varchar, penalty_minutes int)");
        db.update("INSERT INTO seasons VALUES(1,'completed'),(2,'active'),(3,'completed')");
        db.update("INSERT INTO teams VALUES(10,'Gold'),(11,'Navy')");
        db.execute("CREATE TABLE users(id bigint PRIMARY KEY, username varchar, is_active boolean)");
        db.execute("CREATE TABLE season_recaps(season_id bigint PRIMARY KEY, recap_json text, generated_at timestamp with time zone, generated_by bigint)");
        db.update("INSERT INTO users VALUES(7,'admin',true),(8,'inactive',false)");
        service = new SeasonRecapService(db, new ObjectMapper().findAndRegisterModules());
    }
    void game(long id, long season, String type, String round, String status, Integer home, Integer away, Long forfeit) {
        db.update("INSERT INTO games VALUES(?,?,10,11,?,?,TIMESTAMP '2026-03-01 20:00:00',?,?,?,?,false,false)", id, season, home, away, status, type, round, forfeit);
    }
    @Test void totalsOnlyCompletedLeagueGamesAndRecordedPenalties() {
        game(1,1,"REGULAR_SEASON",null,"completed",5,3,null);
        game(2,1,"PLAYOFF","FINAL","completed",4,2,null);
        game(3,1,"TOURNAMENT",null,"completed",99,99,null);
        game(4,1,"REGULAR_SEASON",null,"scheduled",20,20,null);
        game(5,3,"REGULAR_SEASON",null,"completed",30,30,null);
        db.update("INSERT INTO game_events VALUES(1,'penalty',2),(1,'PENALTY',5),(1,'GOAL',0),(3,'PENALTY',10),(4,'PENALTY',10),(5,'PENALTY',10)");
        var r=service.get(1);
        assertEquals(2,r.gamesPlayed()); assertEquals(14L,r.totalGoals()); assertEquals(2,r.penaltiesRecorded()); assertEquals(7,r.penaltyMinutes());
        assertEquals("Gold",r.champion().teamName()); assertEquals(1,r.highestScoringGame().id());
    }
    @Test void publishedRecapSurvivesChangesUntilRegenerated() {
        game(1,1,"REGULAR_SEASON",null,"completed",5,3,null);
        var published = service.generate(1,"admin");
        assertNotNull(published.generatedAt()); assertEquals(8L, published.totalGoals());
        db.update("UPDATE games SET home_score=9 WHERE id=1");
        assertEquals(8L,service.get(1).totalGoals());
        assertEquals(published.generatedAt(),service.get(1).generatedAt());
        assertEquals(12L,service.generate(1,"admin").totalGoals());
        assertEquals(12L,service.get(1).totalGoals());
        assertEquals(1,db.queryForObject("SELECT count(*) FROM season_recaps",Integer.class));
        assertEquals(7,db.queryForObject("SELECT generated_by FROM season_recaps",Integer.class));
    }
    @Test void publicationRejectsInactiveOrUnknownAccountsAndActiveSeason() {
        assertEquals(HttpStatus.FORBIDDEN,assertThrows(ResponseStatusException.class,()->service.generate(1,"inactive")).getStatusCode());
        assertThrows(ResponseStatusException.class,()->service.generate(1,"missing"));
        assertEquals(HttpStatus.CONFLICT,assertThrows(ResponseStatusException.class,()->service.generate(2,"admin")).getStatusCode());
        assertEquals(0,db.queryForObject("SELECT count(*) FROM season_recaps",Integer.class));
    }
    @Test void noFinalDoesNotInventChampion() {
        game(1,1,"REGULAR_SEASON",null,"completed",9,0,null);
        assertNull(service.get(1).champion());
    }
    @Test void tiedAndAmbiguousFinalsDoNotProduceChampion() {
        game(1,1,"PLAYOFF","FINAL","completed",3,3,null);
        assertNull(service.get(1).champion());
        game(2,1,"PLAYOFF","FINAL","completed",3,1,null);
        assertNull(service.get(1).champion());
    }
    @Test void missingScoresAreNotZeroGoals() {
        game(1,1,"REGULAR_SEASON",null,"completed",null,null,null);
        var r=service.get(1);
        assertEquals(1,r.gamesPlayed()); assertEquals(0,r.scoredGames()); assertNull(r.totalGoals()); assertNull(r.highestScoringGame());
    }
    @Test void forfeitsDoNotInflatePlayedTotalsButCanAwardChampionship() {
        game(1,1,"PLAYOFF","FINAL","completed",0,0,10L);
        db.update("INSERT INTO game_events VALUES(1,'penalty',2)");
        var r=service.get(1);
        assertEquals(0,r.gamesPlayed()); assertEquals(1,r.forfeits()); assertEquals(0,r.penaltiesRecorded());
        assertEquals("Navy",r.champion().teamName()); assertTrue(r.champion().byForfeit());
    }
    @Test void highestScoringTiesUseStableGameOrder() {
        game(2,1,"REGULAR_SEASON",null,"completed",5,3,null);
        game(1,1,"REGULAR_SEASON",null,"completed",4,4,null);
        var r=service.get(1); assertEquals(2,r.highestScoringTies()); assertEquals(1,r.highestScoringGame().id());
    }
    @Test void emptyArchiveAndWrongSeasonAreHandled() {
        var empty=service.get(1); assertEquals(0,empty.gamesPlayed()); assertNull(empty.champion()); assertNull(empty.totalGoals());
        assertEquals(HttpStatus.NOT_FOUND,assertThrows(ResponseStatusException.class,()->service.get(999)).getStatusCode());
        assertEquals(HttpStatus.CONFLICT,assertThrows(ResponseStatusException.class,()->service.get(2)).getStatusCode());
    }
    @Test void invalidForfeitAndUnfinishedFinalAreNotChampions() {
        game(1,1,"PLAYOFF","FINAL","completed",0,0,99L); assertNull(service.get(1).champion());
        db.update("UPDATE games SET status='scheduled',forfeit_team_id=NULL,home_score=7,away_score=2");
        assertNull(service.get(1).champion());
    }
}
