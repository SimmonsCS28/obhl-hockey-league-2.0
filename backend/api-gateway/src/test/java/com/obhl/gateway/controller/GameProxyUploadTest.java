package com.obhl.gateway.controller;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestTemplate;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GameProxyUploadTest {
    @Test void forwardsMultipartBytesAndUserTokenWithoutInternalCredential() throws Exception {
        RestTemplate rest = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(rest).build();
        GameProxyController controller = new GameProxyController(rest);
        ReflectionTestUtils.setField(controller, "gameServiceUrl", "http://game-service:8002");
        var mvc = MockMvcBuilders.standaloneSetup(controller)
                .addPlaceholderValue("api.v1.prefix", "/api/v1").build();
        server.expect(requestTo("http://game-service:8002/api/v1/games/upload-slots"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer user-token"))
                .andExpect(headerDoesNotExist("X-Internal-Service-Key"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.MULTIPART_FORM_DATA))
                .andExpect(content().string(containsString("filename=\"slots.csv\"")))
                .andExpect(content().string(containsString("Rink café")))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        mvc.perform(multipart("/api/v1/games/upload-slots")
                .file(new MockMultipartFile("file", "slots.csv", "text/csv", "Week,Rink\n1,Rink café\n".getBytes(StandardCharsets.UTF_8)))
                .header("Authorization", "Bearer user-token")
                .header("X-Internal-Service-Key", "browser-controlled-key"))
                .andExpect(status().isOk());
        server.verify();
    }
}
