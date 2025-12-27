# Docker Test Database Setup & Usage

## Quick Start

### 1. Start Test Database
```powershell
docker-compose -f docker-compose.test.yml up -d
```

### 2. Verify Database is Running
```powershell
docker ps
# Should show: obhl-test-db running on port 5433
```

### 3. Start Backend Services with Test Profile
Open 3 separate PowerShell terminals:

**Terminal 1 - Stats Service:**
```powershell
cd backend\stats-service
$env:SPRING_PROFILES_ACTIVE="test"
.\gradlew bootRun
```

**Terminal 2 - API Gateway:**
```powershell
cd backend\api-gateway
$env:SPRING_PROFILES_ACTIVE="test"
.\gradlew bootRun
```

**Terminal 3 - League Service:**
```powershell
cd backend\league-service
$env:SPRING_PROFILES_ACTIVE="test"
.\gradlew bootRun
```

### 4. Frontend (already running)
Your frontend is already running on the dev server - no changes needed!

## Database Management

### View Database Contents
```powershell
# Connect to database
docker exec -it obhl-test-db psql -U obhl_user -d obhl_test

# Inside psql:
\dt                          # List all tables
SELECT * FROM seasons;       # View seasons
SELECT * FROM teams;         # View teams
SELECT * FROM players;       # View players
\q                          # Quit
```

### Clean Database (Between Tests)
```powershell
# Option 1: Delete all data (keeps tables)
docker exec -it obhl-test-db psql -U obhl_user -d obhl_test -c "TRUNCATE seasons, teams, players, draft_saves CASCADE;"

# Option 2: Complete reset (removes everything)
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
# Wait 5 seconds for DB to be ready, then restart services
```

### Stop Test Database
```powershell
docker-compose -f docker-compose.test.yml down
```

## Testing Workflow

1. **Start fresh**: Clean database
2. **Run test**: Execute test from testing_checklist.md
3. **Verify**: Check database contents
4. **Clean**: Truncate tables for next test
5. **Repeat**

## Troubleshooting

### Services can't connect to database
- Check if test DB is running: `docker ps`
- Check port 5433 is not in use: `netstat -an | findstr 5433`
- Restart test DB: `docker-compose -f docker-compose.test.yml restart`

### Tables not created
- Check service logs for errors
- Verify `ddl-auto: update` in application-test.yml
- Manually create if needed (see below)

### Manual Table Creation (if needed)
```sql
-- Connect to database
docker exec -it obhl-test-db psql -U obhl_user -d obhl_test

-- Create tables (JPA should do this automatically)
-- Only use if auto-creation fails
```

## Configuration Details

**Test Database:**
- Host: localhost
- Port: 5433 (production uses 5432)
- Database: obhl_test
- User: obhl_user
- Password: obhl_password

**Schema Management:**
- `ddl-auto: update` - Auto-creates/updates tables
- `show-sql: true` - Shows all SQL queries in console
- Useful for debugging

## After Testing

When you're done testing and want to apply changes to production:

1. Document any schema changes
2. Test on production copy first
3. Create backup of production DB
4. Apply changes during maintenance window
5. Keep test DB for future testing
