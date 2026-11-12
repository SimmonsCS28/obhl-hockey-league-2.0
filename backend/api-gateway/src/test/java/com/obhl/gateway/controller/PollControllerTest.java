package com.obhl.gateway.controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.obhl.gateway.config.SecurityConfig;
import com.obhl.gateway.service.PollService;
import com.obhl.gateway.util.JwtUtil;

@WebMvcTest(PollController.class)
@Import(SecurityConfig.class)
class PollControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean PollService polls;
    @MockitoBean JwtUtil jwt;

    @Test void anonymousCannotReadOrVote() throws Exception {
        mvc.perform(get("/api/v1/polls")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/polls/1/vote").contentType(MediaType.APPLICATION_JSON).content("{\"optionId\":2}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(polls);
    }
    @Test void membersCannotCreateOrClose() throws Exception {
        mvc.perform(post("/api/v1/polls").with(user("member").roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"Where?\",\"options\":[\"A\",\"B\"]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/polls/1/close").with(user("member").roles("USER"))).andExpect(status().isForbidden());
        verifyNoInteractions(polls);
    }
    @Test void voteIdentityComesFromAuthentication() throws Exception {
        mvc.perform(put("/api/v1/polls/1/vote").with(user("member").roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"optionId\":2,\"userId\":999}"))
                .andExpect(status().isOk());
        verify(polls).vote(eq("member"), eq(1L), eq(new PollService.Vote(2L)));
    }
    @Test void adminCanCreateAndClose() throws Exception {
        mvc.perform(post("/api/v1/polls").with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"Where?\",\"options\":[\"A\",\"B\"]}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/polls/1/close").with(user("admin").roles("ADMIN"))).andExpect(status().isOk());
        verify(polls).create(eq("admin"), any()); verify(polls).close("admin", 1L);
    }
}
