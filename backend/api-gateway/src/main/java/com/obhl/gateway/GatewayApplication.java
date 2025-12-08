package com.obhl.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@SpringBootApplication
public class GatewayApplication {

    public static void main(String[] args) {
        // If run with --hash-password argument, generate BCrypt hash and exit
        if (args.length > 0 && "--hash-password".equals(args[0])) {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
            String password = args.length > 1 ? args[1] : "Inn3Rd@yRu$Ted";
            String hash = encoder.encode(password);
            System.out.println("\n=== BCrypt Password Hash ===");
            System.out.println("Password: " + password);
            System.out.println("Hash: " + hash);
            System.out.println("\nSQL to update user:");
            System.out.println(
                    "UPDATE users SET password_hash = '" + hash + "' WHERE username = 'simmonscs28@gmail.com';");
            System.out.println("============================\n");
            System.exit(0);
        }

        SpringApplication.run(GatewayApplication.class, args);
    }
}
