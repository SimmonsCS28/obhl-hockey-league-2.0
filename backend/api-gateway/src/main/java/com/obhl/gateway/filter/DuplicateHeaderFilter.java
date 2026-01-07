package com.obhl.gateway.filter;

import java.io.IOException;
import java.util.Collection;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;

/**
 * Filter to prevent duplicate Transfer-Encoding headers that cause 502 errors
 * with Nginx.
 * This is a known issue with Spring Boot + Nginx integration.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DuplicateHeaderFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Wrap the response to clean up duplicate headers
        HttpServletResponseWrapper wrappedResponse = new HttpServletResponseWrapper(httpResponse) {
            @Override
            public void addHeader(String name, String value) {
                // Prevent duplicate Transfer-Encoding headers
                if ("Transfer-Encoding".equalsIgnoreCase(name)) {
                    Collection<String> existingHeaders = getHeaders(name);
                    if (existingHeaders != null && !existingHeaders.isEmpty()) {
                        // Header already exists, don't add duplicate
                        return;
                    }
                }
                super.addHeader(name, value);
            }

            @Override
            public void setHeader(String name, String value) {
                super.setHeader(name, value);
            }
        };

        chain.doFilter(request, wrappedResponse);
    }
}
