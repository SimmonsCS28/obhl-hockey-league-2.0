package com.obhl.gateway.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class AuthDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginRequest {
        private String usernameOrEmail; // Can be username or email
        private String password;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginResponse {
        private String token;
        private String tokenType = "Bearer";
        private UserInfo user;
        private Boolean mustChangePassword;
        private Boolean hasSecurityQuestion;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserInfo {
        private Long id;
        private String username;
        private String email;
        private String firstName;
        private String lastName;
        @Deprecated
        private String role;
        private List<String> roles;
        private Long teamId;
        private java.time.Instant lastLogin;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChangePasswordRequest {
        private String oldPassword;
        private String newPassword;
        // Optional — only sent on first login when no security question is set yet
        private String securityQuestion;
        private String securityAnswer;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProfileResponse {
        private String username;
        private String email;
        private String securityQuestion;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateProfileRequest {
        // Required to authorize any change
        private String currentPassword;

        // All optional — only provided fields are updated
        private String username;
        private String email;
        private String newPassword;
        private String securityQuestion;
        private String securityAnswer;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateProfileResponse {
        private String message;
        private UserInfo user;
        // Present only if the username changed, since existing JWTs key off username
        private String token;
    }
}
