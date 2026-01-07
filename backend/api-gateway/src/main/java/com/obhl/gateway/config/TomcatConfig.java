package com.obhl.gateway.config;

import org.apache.coyote.http11.Http11NioProtocol;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration to fix duplicate Transfer-Encoding headers issue with Nginx.
 * Forces HTTP/1.1 without chunked encoding to avoid header duplication.
 */
@Configuration
public class TomcatConfig {

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> tomcatCustomizer() {
        return factory -> factory.addConnectorCustomizers(connector -> {
            Http11NioProtocol protocol = (Http11NioProtocol) connector.getProtocolHandler();
            // Disable chunked transfer encoding to prevent duplicate headers
            protocol.setUseKeepAliveResponseHeader(false);
        });
    }
}
