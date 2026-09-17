package com.obhl.gateway.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.obhl.gateway.model.AppSetting;

@Repository
public interface AppSettingRepository extends JpaRepository<AppSetting, String> {
}
