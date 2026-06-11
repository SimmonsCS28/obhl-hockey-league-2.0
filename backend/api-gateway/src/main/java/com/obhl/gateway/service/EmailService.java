package com.obhl.gateway.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Sends transactional emails via the Resend API (https://resend.com).
 * Free tier covers this app's volume without needing an SMTP server.
 */
@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private final RestTemplate restTemplate;

    @Value("${resend.api.key:}")
    private String resendApiKey;

    @Value("${resend.from.email:OBHL <onboarding@resend.dev>}")
    private String fromEmail;

    public EmailService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public void sendPasswordResetEmail(String toEmail, String resetLink) {
        String subject = "Reset your OBHL password";
        String html = "<p>We received a request to reset your OBHL password.</p>"
                + "<p><a href=\"" + resetLink + "\">Click here to reset your password</a></p>"
                + "<p>This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>";

        send(toEmail, subject, html);
    }

    private void send(String toEmail, String subject, String html) {
        if (resendApiKey == null || resendApiKey.isBlank()) {
            logger.warn("RESEND_API_KEY is not configured; skipping email send to {}", toEmail);
            return;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(resendApiKey);

        Map<String, Object> body = Map.of(
                "from", fromEmail,
                "to", toEmail,
                "subject", subject,
                "html", html);

        try {
            restTemplate.postForEntity(RESEND_API_URL, new HttpEntity<>(body, headers), String.class);
        } catch (Exception e) {
            logger.error("Failed to send email to {}: {}", toEmail, e.getMessage());
        }
    }
}
