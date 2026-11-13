package com.obhl.gateway.controller;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.obhl.gateway.service.PollService;
import com.obhl.gateway.service.PollService.*;

@RestController
@RequestMapping("/api/v1/polls")
@PreAuthorize("isAuthenticated()")
public class PollController {
    private final PollService polls;
    public PollController(PollService polls) { this.polls = polls; }

    @GetMapping
    public List<Poll> list(Authentication auth) { return polls.list(auth.getName()); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public Poll create(Authentication auth, @RequestBody CreatePoll input) { return polls.create(auth.getName(), input); }

    @PutMapping("/{id}/vote")
    public Poll vote(Authentication auth, @PathVariable long id, @RequestBody Vote input) {
        return polls.vote(auth.getName(), id, input);
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasRole('ADMIN')")
    public Poll close(Authentication auth, @PathVariable long id) { return polls.close(auth.getName(), id); }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> error(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason() == null ? "Request failed." : ex.getReason()));
    }
}
