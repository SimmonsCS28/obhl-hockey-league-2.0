#!/bin/bash
# Install bcrypt if missing
pip3 install bcrypt -q 2>/dev/null

# Generate hash for 'password'
python3 -c "import bcrypt; print(bcrypt.hashpw(b'password', bcrypt.gensalt()).decode())" > /tmp/new_hash.txt
NEW_HASH=$(cat /tmp/new_hash.txt)
echo "Generated hash for 'password': $NEW_HASH"

# Update DB
sudo docker exec obhl-postgres psql -U obhl_admin -d obhl_db -c "UPDATE users SET password_hash = '$NEW_HASH' WHERE username = 'simmonscs28';"
echo "Password reset complete."
