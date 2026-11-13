package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;

class PollServiceTest {
    JdbcTemplate db = mock(JdbcTemplate.class);
    UserRepository users = mock(UserRepository.class);
    PollService service = new PollService(db, users);
    User member;
    @BeforeEach void setup() {
        member = new User(); member.setId(7L); member.setIsActive(true);
        when(users.findByUsername("member")).thenReturn(Optional.of(member));
    }
    @Test void rejectsDuplicateAndBlankOptionsBeforeWriting() {
        for (List<String> choices : List.of(List.of("A", " a "), List.of("A", " "), Arrays.asList("A", null), List.of("Only one"))) {
            var ex = assertThrows(ResponseStatusException.class, () -> service.create("member",
                    new PollService.CreatePoll("Question", "", choices, null)));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }
        verifyNoInteractions(db);
    }
    @Test void rejectsInvalidQuestionAndPastDeadline() {
        assertThrows(ResponseStatusException.class, () -> service.create("member", new PollService.CreatePoll(" ", "", List.of("A", "B"), null)));
        assertThrows(ResponseStatusException.class, () -> service.create("member", new PollService.CreatePoll("Q", "", List.of("A", "B"), Instant.EPOCH)));
        verifyNoInteractions(db);
    }
    @Test void inactiveAccountCannotReadOrVote() {
        member.setIsActive(false);
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class, () -> service.list("member")).getStatusCode());
        assertThrows(ResponseStatusException.class, () -> service.vote("member", 1, new PollService.Vote(1L)));
        verifyNoInteractions(db);
    }
    @Test void deletedAccountCannotVote() {
        when(users.findByUsername("member")).thenReturn(Optional.empty());
        assertThrows(ResponseStatusException.class, () -> service.vote("member", 1, new PollService.Vote(1L)));
        verifyNoInteractions(db);
    }
}
