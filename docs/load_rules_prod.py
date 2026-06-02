import subprocess

with open(r'e:\projects\obhl-hockey-league-2.0\docs\rules.html', 'r', encoding='utf-8') as f:
    html = f.read()

sql_content = html.replace("'", "''")
sql = f"INSERT INTO league_rules (content, updated_by_name, updated_at) VALUES ('{sql_content}', 'Admin', NOW());"

# Pipe SQL via SSH into production postgres
ssh_cmd = [
    'ssh', '-i', r'C:\Users\Simmo\obhl-key.pem', 'ubuntu@44.193.17.173',
    'docker exec -i obhl-postgres psql -U obhl_admin -d obhl_db'
]

result = subprocess.run(ssh_cmd, input=sql.encode('utf-8'), capture_output=True, timeout=30)
print('stdout:', result.stdout.decode())
print('stderr:', result.stderr.decode())
print('returncode:', result.returncode)
