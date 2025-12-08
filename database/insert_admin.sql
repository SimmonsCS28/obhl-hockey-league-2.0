INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
    'admin',
    'simmonscs28@gmail.com',
    '$2a$10$0p1J.ri8kf75ooffxhAK1FuK0p/.cGzqqgh0XDDarCfdWIoRwUWxc2',
    'ADMIN',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;
