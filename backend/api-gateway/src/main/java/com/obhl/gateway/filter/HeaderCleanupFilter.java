package com.obhl.gateway.filter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;

/**
 * Filter to prevent duplicate headers, specifically Transfer-Encoding,
 * which can cause issues with Nginx reverse proxy.
 */
@Component
public class HeaderCleanupFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (response instanceof HttpServletResponse) {
            HttpServletResponse httpResponse = (HttpServletResponse) response;
            HeaderCleanupResponseWrapper wrapper = new HeaderCleanupResponseWrapper(httpResponse);
            chain.doFilter(request, wrapper);
        } else {
            chain.doFilter(request, response);
        }
    }

    private static class HeaderCleanupResponseWrapper extends HttpServletResponseWrapper {
        private final Map<String, String> headers = new LinkedHashMap<>();

        public HeaderCleanupResponseWrapper(HttpServletResponse response) {
            super(response);
        }

        @Override
        public void setHeader(String name, String value) {
            headers.put(name.toLowerCase(), value);
            super.setHeader(name, value);
        }

        @Override
        public void addHeader(String name, String value) {
            String lowerCaseName = name.toLowerCase();
            // Only add if not already set (prevents duplicates)
            if (!headers.containsKey(lowerCaseName)) {
                headers.put(lowerCaseName, value);
                super.addHeader(name, value);
            }
        }
    }
}
