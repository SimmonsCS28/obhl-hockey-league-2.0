import bcrypt

# Generate hash for admin123
password = b"admin123"
# Use $2a$ prefix for compatibility with Spring Security BCrypt
hashed = bcrypt.hashpw(password, bcrypt.gensalt(rounds=10, prefix=b"2a"))
print(f"Password: admin123")
print(f"Hash: {hashed.decode('utf-8')}")
