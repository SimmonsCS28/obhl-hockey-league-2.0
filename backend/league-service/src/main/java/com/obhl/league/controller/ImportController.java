package com.obhl.league.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.obhl.league.service.ExcelParserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/import")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "*", allowCredentials = "false")
public class ImportController {

    private final ExcelParserService excelParserService;

    @PostMapping("/registration")
    public ResponseEntity<?> importRegistrationFile(@RequestParam("file") MultipartFile file) {
        try {
            List<Map<String, Object>> players = excelParserService.parseRegistrationFile(file);
            return ResponseEntity.ok(players);
        } catch (IOException e) {
            return ResponseEntity.badRequest().body("Failed to parse file: " + e.getMessage());
        }
    }
}
