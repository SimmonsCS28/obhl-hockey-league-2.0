package com.obhl.gateway.dto;

import java.util.List;
import java.util.Map;

public class PlayerDashboardDTO {
    private String firstName;
    private String lastName;
    private Map<String, Object> team;
    private TeamRecord record;
    private Map<String, Object> nextGame;
    private List<Map<String, Object>> schedule;

    public PlayerDashboardDTO() {
    }

    public PlayerDashboardDTO(String firstName, String lastName, Map<String, Object> team, TeamRecord record,
            Map<String, Object> nextGame,
            List<Map<String, Object>> schedule) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.team = team;
        this.record = record;
        this.nextGame = nextGame;
        this.schedule = schedule;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public Map<String, Object> getTeam() {
        return team;
    }

    public void setTeam(Map<String, Object> team) {
        this.team = team;
    }

    public TeamRecord getRecord() {
        return record;
    }

    public void setRecord(TeamRecord record) {
        this.record = record;
    }

    public Map<String, Object> getNextGame() {
        return nextGame;
    }

    public void setNextGame(Map<String, Object> nextGame) {
        this.nextGame = nextGame;
    }

    public List<Map<String, Object>> getSchedule() {
        return schedule;
    }

    public void setSchedule(List<Map<String, Object>> schedule) {
        this.schedule = schedule;
    }

    public static class TeamRecord {
        private int wins;
        private int losses;
        private int ties;
        private int otLosses;

        public TeamRecord() {
        }

        public TeamRecord(int wins, int losses, int ties, int otLosses) {
            this.wins = wins;
            this.losses = losses;
            this.ties = ties;
            this.otLosses = otLosses;
        }

        public int getWins() {
            return wins;
        }

        public void setWins(int wins) {
            this.wins = wins;
        }

        public int getLosses() {
            return losses;
        }

        public void setLosses(int losses) {
            this.losses = losses;
        }

        public int getTies() {
            return ties;
        }

        public void setTies(int ties) {
            this.ties = ties;
        }

        public int getOtLosses() {
            return otLosses;
        }

        public void setOtLosses(int otLosses) {
            this.otLosses = otLosses;
        }
    }
}
