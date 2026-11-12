package com.obhl.gateway.controller;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.obhl.gateway.config.SecurityConfig;
import com.obhl.gateway.service.SeasonRecapService;
import com.obhl.gateway.util.JwtUtil;

@WebMvcTest(SeasonRecapController.class)
@Import(SecurityConfig.class)
class SeasonRecapControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean SeasonRecapService recaps;
    @MockitoBean JwtUtil jwt;
    @Test void publicCanReadButCannotGenerate() throws Exception {
        mvc.perform(get("/api/v1/seasons/1/recap")).andExpect(status().isOk());
        verify(recaps).get(1L);
        mvc.perform(post("/api/v1/seasons/1/recap/generate")).andExpect(status().isUnauthorized());
        verifyNoMoreInteractions(recaps);
    }
    @Test void memberCannotGenerate() throws Exception {
        mvc.perform(post("/api/v1/seasons/1/recap/generate").with(user("member").roles("USER")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(recaps);
    }
    @Test void adminPublishesUnderAuthenticatedIdentity() throws Exception {
        mvc.perform(post("/api/v1/seasons/1/recap/generate").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk());
        verify(recaps).generate(1L,"admin");
    }
}
