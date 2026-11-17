#!/usr/bin/env python3
"""Exercise real chunked lists through the disposable obhl-security gateway and Nginx.

Creates 400 synthetic games and players in a unique test season, checks complete JSON
and response framing, then removes only that season's fixtures even on failure.
Never use against production or a shared development database.
"""
import argparse
import base64
import hashlib
import hmac
import http.client
import json
from pathlib import Path
import secrets
import subprocess
import time


def run(config_path, docker):
    config = json.loads(config_path.read_text())
    if config.get('name') != 'obhl-security':
        raise ValueError('Only the disposable obhl-security project is allowed')
    services = config['services']
    for name, service in services.items():
        if service.get('container_name') != 'obhl-security-' + name:
            raise ValueError('Unexpected container identity')
        if any(port.get('host_ip') != '127.0.0.1' for port in service.get('ports', [])):
            raise ValueError('Published ports must bind to loopback')
    for name, port in [('api-gateway', 8000), ('game-service', 8002), ('stats-service', 8003), ('frontend', 8080)]:
        if not any(int(p['published']) == port for p in services[name].get('ports', [])):
            raise ValueError('Unexpected test port')
    identity = subprocess.check_output([docker, 'inspect', 'obhl-security-postgres', '--format',
        '{{index .Config.Labels "com.docker.compose.project"}}'], text=True).strip()
    if identity != 'obhl-security':
        raise ValueError('Database container does not belong to the test project')
    env = services['postgres']['environment']

    def sql(statement):
        subprocess.run([docker, 'exec', '-i', 'obhl-security-postgres', 'psql', '-X', '-q',
                        '-v', 'ON_ERROR_STOP=1', '-U', env['POSTGRES_USER'], '-d', env['POSTGRES_DB']],
                       input=statement, text=True, check=True, stdout=subprocess.DEVNULL)

    season = -secrets.randbelow(1_000_000_000) - 1
    home, away = season * 2, season * 2 - 1
    count = 400
    seeded = False
    try:
        sql(f"""BEGIN;
INSERT INTO seasons (id,name,start_date,end_date,status,is_active,type)
VALUES ({season},'Proxy response fixture {season}','2026-01-01','2026-12-31','upcoming',false,'LEAGUE');
INSERT INTO teams (id,name,abbreviation,season_id,eliminated)
VALUES ({home},'Fixture Home','FH',{season},false),({away},'Fixture Away','FA',{season},false);
INSERT INTO games (season_id,home_team_id,away_team_id,game_date,venue,status,game_type)
SELECT {season},{home},{away},timestamp '2026-11-17 01:00:00' + n * interval '1 day',
       'Synthetic proxy test rink','scheduled','REGULAR_SEASON' FROM generate_series(1,{count}) n;
INSERT INTO players (season_id,team_id,first_name,last_name,position,email,is_active)
SELECT {season},{home},'Fixture',concat('Player ',n),'F',concat('fixture-',n,'-{season}@example.invalid'),true
FROM generate_series(1,{count}) n;
COMMIT;""")
        seeded = True
        secret = services['api-gateway']['environment']['JWT_SECRET']
        def encode(value):
            return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b'=')
        payload = encode({'alg': 'HS256', 'typ': 'JWT'}) + b'.' + encode({
            'sub': '42', 'username': 'fixture', 'roles': ['ADMIN'], 'exp': int(time.time()) - 60})
        expired = (payload + b'.' + base64.urlsafe_b64encode(
            hmac.new(secret.encode(), payload, hashlib.sha256).digest()).rstrip(b'=')).decode()
        targets = [(8002, '/api/v1/games'), (8003, '/api/v1/players'),
                   (8000, '/api/v1/games'), (8000, '/api/v1/players'),
                   (8080, '/api/v1/games'), (8080, '/api/v1/players'),
                   (8080, '/games-api/games'), (8080, '/stats-api/players')]
        records = []
        for port, path in targets:
            for label, auth in [('anonymous', None), ('invalid', 'junk'), ('expired', expired)]:
                conn = http.client.HTTPConnection('127.0.0.1', port, timeout=20)
                try:
                    conn.request('GET', f'{path}?seasonId={season}', headers={
                        'Authorization': 'Bearer ' + auth} if auth else {})
                    response = conn.getresponse()
                    body = response.read()
                    assert response.status == 200, f'{port}{path} {label}: HTTP {response.status}'
                    te = response.headers.get_all('Transfer-Encoding', [])
                    cl = response.headers.get_all('Content-Length', [])
                    assert len(te) <= 1 and len(cl) <= 1 and not (te and cl), 'Ambiguous response framing'
                    assert not te or te[0].lower() == 'chunked', f'Unexpected Transfer-Encoding: {te}'
                    rows = json.loads(body)
                    assert len(rows) == count and len(body) > 8192, 'Incomplete or undersized fixture'
                    assert all(row['seasonId'] == season for row in rows), 'Wrong fixture season'
                    if 'players' in path:
                        assert all('email' not in row and 'skillRating' not in row for row in rows), 'Public masking regressed'
                    if port in (8002, 8003):
                        assert te == ['chunked'], 'Direct response did not exercise chunked transfer'
                    records.append({'port': port, 'path': path, 'auth': label, 'bytes': len(body), 'rows': len(rows)})
                    print(f'PASS {port}{path} {label}: {len(rows)} rows, {len(body)} bytes')
                finally:
                    conn.close()
        return records
    finally:
        if seeded:
            sql(f'BEGIN; DELETE FROM games WHERE season_id={season}; DELETE FROM players WHERE season_id={season}; '
                f'DELETE FROM teams WHERE season_id={season}; DELETE FROM seasons WHERE id={season}; COMMIT;')
            print('Removed synthetic season, teams, games, and players.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('compose_json', type=Path)
    parser.add_argument('--docker', default='docker')
    args = parser.parse_args()
    checks = run(args.compose_json, args.docker)
    print(f'{len(checks)}/{len(checks)} large-response checks passed')
