package com.obhl.gateway.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class TeamDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Create {
        @NotBlank(message = "Team name is required")
        @Size(min = 1, max = 100)
        private String name;

        @NotBlank(message = "Abbreviation is required")
        @Size(min = 2, max = 10)
        private String abbreviation;

        @NotNull(message = "Season ID is required")
        @Positive
        private Long seasonId;

        @Size(max = 500)
        private String logoUrl;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
        private String teamColor;

        private Long gmId; // Can be null initially, set after players are created

        private Boolean active = true;

        @Min(0)
        private Integer points = 0;

        @Min(0)
        private Integer wins = 0;

        @Min(0)
        private Integer losses = 0;

        @Min(0)
        private Integer ties = 0;

        @Min(0)
        private Integer overtimeWins = 0;

        @Min(0)
        private Integer overtimeLosses = 0;

        @Min(0)
        private Integer goalsFor = 0;

        @Min(0)
        private Integer goalsAgainst = 0;

        // Manual Getters/Setters
        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getAbbreviation() {
            return abbreviation;
        }

        public void setAbbreviation(String abbreviation) {
            this.abbreviation = abbreviation;
        }

        public Long getSeasonId() {
            return seasonId;
        }

        public void setSeasonId(Long seasonId) {
            this.seasonId = seasonId;
        }

        public String getLogoUrl() {
            return logoUrl;
        }

        public void setLogoUrl(String logoUrl) {
            this.logoUrl = logoUrl;
        }

        public String getTeamColor() {
            return teamColor;
        }

        public void setTeamColor(String teamColor) {
            this.teamColor = teamColor;
        }

        public Long getGmId() {
            return gmId;
        }

        public void setGmId(Long gmId) {
            this.gmId = gmId;
        }

        public Boolean getActive() {
            return active;
        }

        public void setActive(Boolean active) {
            this.active = active;
        }

        public Integer getPoints() {
            return points;
        }

        public void setPoints(Integer points) {
            this.points = points;
        }

        public Integer getWins() {
            return wins;
        }

        public void setWins(Integer wins) {
            this.wins = wins;
        }

        public Integer getLosses() {
            return losses;
        }

        public void setLosses(Integer losses) {
            this.losses = losses;
        }

        public Integer getTies() {
            return ties;
        }

        public void setTies(Integer ties) {
            this.ties = ties;
        }

        public Integer getOvertimeWins() {
            return overtimeWins;
        }

        public void setOvertimeWins(Integer overtimeWins) {
            this.overtimeWins = overtimeWins;
        }

        public Integer getOvertimeLosses() {
            return overtimeLosses;
        }

        public void setOvertimeLosses(Integer overtimeLosses) {
            this.overtimeLosses = overtimeLosses;
        }

        public Integer getGoalsFor() {
            return goalsFor;
        }

        public void setGoalsFor(Integer goalsFor) {
            this.goalsFor = goalsFor;
        }

        public Integer getGoalsAgainst() {
            return goalsAgainst;
        }

        public void setGoalsAgainst(Integer goalsAgainst) {
            this.goalsAgainst = goalsAgainst;
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Update {
        @Size(min = 1, max = 100)
        private String name;

        @Size(min = 2, max = 10)
        private String abbreviation;

        @Positive
        private Long seasonId;

        @Size(max = 500)
        private String logoUrl;

        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
        private String teamColor;

        @Positive
        private Long gmId;

        private Boolean active;

        @Min(0)
        private Integer points;

        @Min(0)
        private Integer wins;

        @Min(0)
        private Integer losses;

        @Min(0)
        private Integer ties;

        @Min(0)
        private Integer overtimeWins;

        @Min(0)
        private Integer overtimeLosses;

        @Min(0)
        private Integer goalsFor;

        @Min(0)
        private Integer goalsAgainst;

        // Manual Getters/Setters
        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getAbbreviation() {
            return abbreviation;
        }

        public void setAbbreviation(String abbreviation) {
            this.abbreviation = abbreviation;
        }

        public Long getSeasonId() {
            return seasonId;
        }

        public void setSeasonId(Long seasonId) {
            this.seasonId = seasonId;
        }

        public String getLogoUrl() {
            return logoUrl;
        }

        public void setLogoUrl(String logoUrl) {
            this.logoUrl = logoUrl;
        }

        public String getTeamColor() {
            return teamColor;
        }

        public void setTeamColor(String teamColor) {
            this.teamColor = teamColor;
        }

        public Long getGmId() {
            return gmId;
        }

        public void setGmId(Long gmId) {
            this.gmId = gmId;
        }

        public Boolean getActive() {
            return active;
        }

        public void setActive(Boolean active) {
            this.active = active;
        }

        public Integer getPoints() {
            return points;
        }

        public void setPoints(Integer points) {
            this.points = points;
        }

        public Integer getWins() {
            return wins;
        }

        public void setWins(Integer wins) {
            this.wins = wins;
        }

        public Integer getLosses() {
            return losses;
        }

        public void setLosses(Integer losses) {
            this.losses = losses;
        }

        public Integer getTies() {
            return ties;
        }

        public void setTies(Integer ties) {
            this.ties = ties;
        }

        public Integer getOvertimeWins() {
            return overtimeWins;
        }

        public void setOvertimeWins(Integer overtimeWins) {
            this.overtimeWins = overtimeWins;
        }

        public Integer getOvertimeLosses() {
            return overtimeLosses;
        }

        public void setOvertimeLosses(Integer overtimeLosses) {
            this.overtimeLosses = overtimeLosses;
        }

        public Integer getGoalsFor() {
            return goalsFor;
        }

        public void setGoalsFor(Integer goalsFor) {
            this.goalsFor = goalsFor;
        }

        public Integer getGoalsAgainst() {
            return goalsAgainst;
        }

        public void setGoalsAgainst(Integer goalsAgainst) {
            this.goalsAgainst = goalsAgainst;
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
        private String name;
        private String abbreviation;
        private Long seasonId;
        private String logoUrl;
        private String teamColor;
        private Long gmId;
        private String gmName;
        private Boolean active;
        private Integer points;
        private Integer wins;
        private Integer losses;
        private Integer ties;
        private Integer overtimeWins;
        private Integer overtimeLosses;
        private Integer goalsFor;
        private Integer goalsAgainst;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        // Manual Getters/Setters
        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getAbbreviation() {
            return abbreviation;
        }

        public void setAbbreviation(String abbreviation) {
            this.abbreviation = abbreviation;
        }

        public Long getSeasonId() {
            return seasonId;
        }

        public void setSeasonId(Long seasonId) {
            this.seasonId = seasonId;
        }

        public String getLogoUrl() {
            return logoUrl;
        }

        public void setLogoUrl(String logoUrl) {
            this.logoUrl = logoUrl;
        }

        public String getTeamColor() {
            return teamColor;
        }

        public void setTeamColor(String teamColor) {
            this.teamColor = teamColor;
        }

        public Long getGmId() {
            return gmId;
        }

        public void setGmId(Long gmId) {
            this.gmId = gmId;
        }

        public String getGmName() {
            return gmName;
        }

        public void setGmName(String gmName) {
            this.gmName = gmName;
        }

        public Boolean getActive() {
            return active;
        }

        public void setActive(Boolean active) {
            this.active = active;
        }

        public Integer getPoints() {
            return points;
        }

        public void setPoints(Integer points) {
            this.points = points;
        }

        public Integer getWins() {
            return wins;
        }

        public void setWins(Integer wins) {
            this.wins = wins;
        }

        public Integer getLosses() {
            return losses;
        }

        public void setLosses(Integer losses) {
            this.losses = losses;
        }

        public Integer getTies() {
            return ties;
        }

        public void setTies(Integer ties) {
            this.ties = ties;
        }

        public Integer getOvertimeWins() {
            return overtimeWins;
        }

        public void setOvertimeWins(Integer overtimeWins) {
            this.overtimeWins = overtimeWins;
        }

        public Integer getOvertimeLosses() {
            return overtimeLosses;
        }

        public void setOvertimeLosses(Integer overtimeLosses) {
            this.overtimeLosses = overtimeLosses;
        }

        public Integer getGoalsFor() {
            return goalsFor;
        }

        public void setGoalsFor(Integer goalsFor) {
            this.goalsFor = goalsFor;
        }

        public Integer getGoalsAgainst() {
            return goalsAgainst;
        }

        public void setGoalsAgainst(Integer goalsAgainst) {
            this.goalsAgainst = goalsAgainst;
        }

        public LocalDateTime getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
        }

        public LocalDateTime getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
        }
    }
}
