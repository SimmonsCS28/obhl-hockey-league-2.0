# Generic Scorekeeper Account Setup

## SQL Script to Create Generic Scorekeeper User

Run this SQL in your PostgreSQL database:

```sql
-- Create generic scorekeeper user
INSERT INTO users (email, password, role, created_at, updated_at)
VALUES (
    'scorekeeper@obhl.com',
    '$2a$10$qBXYjvz3rN4u5VuK.h9nCeXc8zPzKyWvM8xW5j4lQyH4vxPEY6.Zm',  -- Password: obhl2026
    'SCOREKEEPER',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;
```

## Credentials

- **Username/Email:** `scorekeeper@obhl.com`
- **Password:** `obhl2026`
- **Role:** SCOREKEEPER

## Usage

1. Navigate to the OBHL website
2. Click "Login" 
3. Enter credentials above
4. You'll be redirected to the scorekeeper dashboard
5. Select a game from the current week to start scoring

## Notes

- This account is for testing and emergency use when a designated scorekeeper doesn't show up
- The password is hashed using BCrypt (same as other users in the system)
- The account has SCOREKEEPER role permissions only (no admin access)
