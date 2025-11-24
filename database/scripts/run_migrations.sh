#!/bin/bash

# Database Migration Script
# Runs all migration files in order

set -e  # Exit on error

# Database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-obhl_db}"
DB_USER="${DB_USER:-obhl_admin}"
DB_PASSWORD="${DB_PASSWORD:-changeme}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting OBHL Database Migrations...${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}Error: Migrations directory not found at $MIGRATIONS_DIR${NC}"
    exit 1
fi

# Set PGPASSWORD for psql
export PGPASSWORD="$DB_PASSWORD"

# Function to run a migration file
run_migration() {
    local file=$1
    local filename=$(basename "$file")
    
    echo -e "${YELLOW}Running migration: $filename${NC}"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"; then
        echo -e "${GREEN}✓ $filename completed successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ $filename failed${NC}"
        return 1
    fi
}

# Run migrations in order
migration_count=0
for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
        run_migration "$migration_file"
        ((migration_count++))
    fi
done

echo ""
echo -e "${GREEN}All migrations completed successfully!${NC}"
echo "Total migrations run: $migration_count"

# Unset password
unset PGPASSWORD
