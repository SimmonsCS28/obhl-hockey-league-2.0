package com.obhl.gateway.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Utility to generate BCrypt password hashes
 * Run this class to hash passwords for manual user creation
 */
public class PasswordHasher {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        // Hash the password: Password!
        String password = "Password!";
        String hash = encoder.encode(password);

        System.out.println("Password: " + password);
        System.out.println("BCrypt Hash: " + hash);
        System.out.println("\nSQL to update test users:");
        System.out.println("UPDATE users SET password_hash = '" + hash
                + "' WHERE username IN ('testRef', 'testScorekeeper', 'testGoalie');");
    }
}
