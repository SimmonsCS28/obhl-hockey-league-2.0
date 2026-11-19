package com.obhl.gateway.client;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;
import org.springframework.context.annotation.Configuration;

import com.obhl.gateway.dto.AnnouncementDTO;
import com.sun.net.httpserver.HttpServer;

import feign.Client;
import feign.hc5.ApacheHttp5Client;

/**
 * Regression guard for the announcement toggle 500. Without feign-hc5 on the classpath,
 * Spring Cloud OpenFeign falls back to the JDK HttpURLConnection, which refuses PATCH
 * ("Invalid HTTP method: PATCH"), so every {@code @PatchMapping} on a gateway Feign client
 * failed before it left the gateway.
 */
class LeagueClientPatchTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class,
                    HttpMessageConvertersAutoConfiguration.class, FeignAutoConfiguration.class))
            .withUserConfiguration(Clients.class);

    private final AtomicReference<String> received = new AtomicReference<>();
    private HttpServer leagueStub;

    @BeforeEach
    void startLeagueStub() throws Exception {
        leagueStub = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        leagueStub.createContext("/api/v1/announcements/7/toggle", exchange -> {
            received.set(exchange.getRequestMethod() + " " + exchange.getRequestURI());
            byte[] body = "{\"id\":7,\"isActive\":false}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        leagueStub.start();
    }

    @AfterEach
    void stopLeagueStub() {
        leagueStub.stop(0);
    }

    @Test
    void feignClientsUseApacheHttpClient5() {
        runner.run(ctx -> assertThat(ctx.getBean(Client.class)).isInstanceOf(ApacheHttp5Client.class));
    }

    @Test
    void toggleActiveReachesLeagueServiceAsPatch() {
        runner.withPropertyValues("league.service.url=http://127.0.0.1:" + leagueStub.getAddress().getPort())
                .run(ctx -> {
                    AnnouncementDTO toggled = ctx.getBean(LeagueClient.class).toggleActive(7, false);

                    assertThat(received.get()).isEqualTo("PATCH /api/v1/announcements/7/toggle?active=false");
                    assertThat(toggled.getIsActive()).isFalse();
                });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableFeignClients(clients = LeagueClient.class)
    static class Clients {
    }
}
