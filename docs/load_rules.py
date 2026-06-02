import subprocess

with open(r'e:\projects\obhl-hockey-league-2.0\docs\rules.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Escape single quotes for psql
sql_content = html.replace("'", "''")

sql = f"INSERT INTO league_rules (content, updated_by_name, updated_at) VALUES ('{sql_content}', 'Admin', NOW());"

with open(r'e:\projects\obhl-hockey-league-2.0\docs\rules_insert.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print(f'SQL file written: {len(sql)} chars')

# Execute against local Docker postgres
result = subprocess.run(
    ['docker', 'exec', '-i', 'obhl-postgres', 'psql', '-U', 'obhl_admin', '-d', 'obhl_db'],
    input=sql.encode('utf-8'),
    capture_output=True
)
print('stdout:', result.stdout.decode())
print('stderr:', result.stderr.decode())
print('returncode:', result.returncode)
