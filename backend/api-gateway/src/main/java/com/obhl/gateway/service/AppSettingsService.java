package com.obhl.gateway.service;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.obhl.gateway.model.AppSetting;
import com.obhl.gateway.repository.AppSettingRepository;

/** League-wide settings that are too small to deserve their own table. */
@Service
public class AppSettingsService {

    /** Where the end-of-season staff pay workbook is emailed. */
    public static final String FINANCE_REPORT_EMAIL = "finance_report_email";

    @Autowired
    private AppSettingRepository repository;

    public Optional<String> get(String key) {
        return repository.findById(key).map(AppSetting::getValue)
                .filter(v -> v != null && !v.isBlank());
    }

    public void set(String key, String value, Long updatedBy) {
        AppSetting s = repository.findById(key).orElseGet(() -> new AppSetting(key, null, null, null));
        s.setValue(value == null ? null : value.trim());
        s.setUpdatedBy(updatedBy);
        repository.save(s);
    }
}
