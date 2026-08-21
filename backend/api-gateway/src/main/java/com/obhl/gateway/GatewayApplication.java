package com.obhl.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@SpringBootApplication
@EnableFeignClients
public class GatewayApplication {

    public static void main(String[] args) {
        // Local admin utility: `--hash-password <plaintext>` prints a BCrypt hash and exits.
        // The plaintext must be supplied — no baked-in default — and no username-specific SQL
        // is printed, since this file lives in a public repo.
        if (args.length > 0 && "--hash-password".equals(args[0])) {
            if (args.length < 2 || args[1].isBlank()) {
                System.err.println("Usage: --hash-password <plaintext-password>");
                System.exit(1);
            }
            String hash = new BCryptPasswordEncoder().encode(args[1]);
            System.out.println(hash);
            System.exit(0);
        }

        SpringApplication.run(GatewayApplication.class, args);
    }
}
