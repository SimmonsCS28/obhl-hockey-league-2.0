# Technical Debt & Future Improvements

This document tracks known technical debt, workarounds, and future improvements needed for the OBHL application.

## 🔴 High Priority

### 1. API Gateway Multipart File Upload Proxy
**Status**: Workaround in place  
**Issue**: API Gateway's `GameProxyController` cannot properly proxy multipart/form-data requests (file uploads) because it reads the request body as a String, which doesn't work for binary data.

**Current Workaround**: 
- Frontend calls game-service directly on port 8002 for file uploads
- `ScheduleManager.jsx` uses `GAME_SERVICE_URL` constant to bypass API Gateway

**Proper Fix Needed**:
- Implement a proper multipart proxy in `GameProxyController.java` that forwards the entire request without reading the body
- Update frontend to use `API_BASE_URL` for all requests
- Close port 8002 from public access once fixed

**Files Affected**:
- `backend/api-gateway/src/main/java/com/obhl/gateway/controller/GameProxyController.java`
- `frontend/src/components/ScheduleManager.jsx` (line 7 has TODO comment)

**References**: 
- See conversation Step 5976 where this workaround was implemented

---

### 2. Nginx Transfer-Encoding Duplicate Header Issue
**Status**: Bypassed  
**Issue**: Nginx returns 502 Bad Gateway when proxying requests to Spring Boot services due to duplicate `Transfer-Encoding: chunked` headers.

**Current Workaround**:
- Exposed service ports directly (8000, 8002, 8003) instead of proxying through Nginx
- Frontend makes direct calls to these ports
- Nginx only serves static frontend files on port 80

**Proper Fix Needed**:
- Investigate why Spring Boot is sending duplicate Transfer-Encoding headers
- Configure Nginx to properly handle or strip duplicate headers
- Route all API traffic through Nginx for better security

**Files Affected**:
- `frontend/nginx.conf`
- Spring Boot services configuration

**Attempted Fixes** (all failed):
- Setting `server.compression.enabled=false` in Spring Boot
- Creating `DuplicateHeaderFilter.java` servlet filter
- Creating `TomcatConfig.java` to disable chunked encoding
- Various Nginx proxy settings (`chunked_transfer_encoding off`, `proxy_buffering off`, etc.)

---

## 🟡 Medium Priority

### 3. Centralize API URLs in Frontend
**Status**: Partially addressed  
**Issue**: Frontend has hardcoded production IP addresses scattered across multiple files instead of using a centralized configuration.

**Current State**:
- All localhost URLs have been replaced with production IP `44.193.17.173`
- Different components use different approaches (some use constants, some hardcode)

**Improvement Needed**:
- Create a single `config.js` file with environment-based URL configuration
- Use environment variables for production/development/staging URLs
- Update all components to use the centralized config

**Files to Update**:
- `frontend/src/services/api.js`
- `frontend/src/components/ScheduleManager.jsx`
- `frontend/src/components/public/*.jsx`
- All other public pages

---

### 4. CORS Configuration Review
**Status**: Working but permissive  
**Issue**: CORS is currently configured to allow all origins (`*`) with credentials disabled.

**Current Config**:
- `SecurityConfig.java`: `setAllowedOriginPatterns(Arrays.asList("*"))` + `setAllowCredentials(false)`

**Improvement Needed**:
- For production, restrict CORS to specific origins (frontend domain only)
- Re-enable credentials if needed for authentication
- Review if wildcard is acceptable for your security requirements

**Files Affected**:
- `backend/api-gateway/src/main/java/com/obhl/gateway/config/SecurityConfig.java`
- `backend/api-gateway/src/main/java/com/obhl/gateway/config/CorsConfig.java`

---

### 5. Port Exposure Security
**Status**: Functional but not ideal  
**Issue**: Multiple backend service ports are exposed directly to the internet.

**Current Exposed Ports**:
- 80: Frontend (Nginx) ✅ Necessary
- 8000: API Gateway ✅ Acceptable
- 8002: Game Service ⚠️ Should be behind gateway
- 8003: Stats Service ⚠️ Should be behind gateway

**Improvement Needed**:
- Route all requests through API Gateway (port 8000 only)
- Close ports 8002 and 8003 from public access
- Only allow internal Docker network access to individual services

**Prerequisite**: Fix #1 (API Gateway multipart proxy) first

---

## 🟢 Low Priority

### 6. Incomplete API Implementations
**Status**: Mock data in place  
**Issue**: Several API methods in `frontend/src/services/api.js` use mock data instead of real API calls.

**Methods with TODO comments**:
- Line 81: `updateGame()`
- Line 95: `deleteGame()`
- Line 113: `submitScore()`
- Line 132: `validateGamePenalties()`
- Line 135: `saveGamePenalties()`
- Line 162: `getLiveGameStatus()`
- Line 165: `getGamePlayers()`
- Line 175: `getTeamPlayers()`

**Fix Needed**:
- Implement actual API endpoints in backend services
- Replace mock data with real API calls
- Update frontend to use real endpoints

---

### 7. Live Score Entry Backend Integration
**Status**: Frontend implemented, backend TODO  
**Issue**: `LiveScoreEntry.jsx` component has placeholder comments for backend integration.

**Files Affected**:
- `frontend/src/components/LiveScoreEntry.jsx` (lines 75, 256)

**Fix Needed**:
- Implement backend endpoints for loading/saving live game events
- Connect frontend to real endpoints

---

## 📝 Notes

- **Last Updated**: 2026-01-07
- **Priority Legend**: 🔴 High | 🟡 Medium | 🟢 Low
- All hardcoded `localhost` URLs were replaced with production IP on 2026-01-07
- AWS Security Group configured with ports: 80, 8000, 8002, 8003

## 🔍 How to Add New Items

When adding technical debt:
1. Choose appropriate priority (High/Medium/Low)
2. Include **Status**, **Issue**, **Current Workaround** (if any), **Proper Fix Needed**
3. List affected files with line numbers
4. Reference conversation steps or PR numbers if available
5. Update "Last Updated" date
