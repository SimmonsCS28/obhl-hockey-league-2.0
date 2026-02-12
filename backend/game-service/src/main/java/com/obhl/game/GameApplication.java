package com.obhl.game;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class GameApplication {

    public static void main(String[] args) {
        System.out.println("DEBUG: Starting GameApplication main method");
        SpringApplication.run(GameApplication.class, args);
    }
}
