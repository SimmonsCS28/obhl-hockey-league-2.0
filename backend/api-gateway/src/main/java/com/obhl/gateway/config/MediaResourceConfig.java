package com.obhl.gateway.config;

import java.nio.file.Paths;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves uploaded highlight media straight off disk.
 *
 * Deliberately a resource handler rather than a @GetMapping that streams bytes:
 * ResourceHttpRequestHandler implements HTTP Range requests, which is what lets a
 * viewer scrub the video timeline. A hand-rolled controller returning the whole
 * file would force the browser to download all of it before seeking works.
 *
 * The path sits under the /api/v1 prefix on purpose — /api already routes to this
 * service in every environment (Vite dev proxy, the docker nginx, and the prod host
 * nginx), so serving media needs no new location block anywhere.
 */
@Configuration
public class MediaResourceConfig implements WebMvcConfigurer {

    @Value("${app.media.root}")
    private String mediaRoot;

    @Value("${api.v1.prefix}")
    private String apiPrefix;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // toUri() rather than "file:" + path — it produces a valid URI on Windows
        // dev machines too, where a raw path starts with a drive letter.
        String location = Paths.get(mediaRoot).toAbsolutePath().normalize().toUri().toString();
        registry.addResourceHandler(apiPrefix + "/highlights/media/**")
                .addResourceLocations(location)
                // Filenames are UUIDs and content never changes under a given key,
                // so these are safe to cache hard.
                .setCachePeriod(365 * 24 * 60 * 60);
    }
}
