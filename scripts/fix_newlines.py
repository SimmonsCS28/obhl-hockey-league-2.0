import os

files = [
    r'e:\projects\obhl-hockey-league-2.0\backend\api-gateway\gradlew',
    r'e:\projects\obhl-hockey-league-2.0\backend\league-service\gradlew',
    r'e:\projects\obhl-hockey-league-2.0\backend\game-service\gradlew',
    r'e:\projects\obhl-hockey-league-2.0\backend\stats-service\gradlew'
]

for file_path in files:
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        
        content = content.replace(b'\r\n', b'\n')
        
        with open(file_path, 'wb') as f:
            f.write(content)
        print(f"Converted {file_path} to LF")
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
