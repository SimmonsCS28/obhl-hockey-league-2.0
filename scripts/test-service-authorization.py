#!/usr/bin/env python3
"""Non-mutating authorization checks against the isolated obhl-security localhost stack.

Reads only locally generated fixture credentials from its rendered Compose JSON.
Requests with bodies always contain invalid JSON, so they cannot create records.
"""
import argparse
import base64
import hashlib
import hmac
import json
from pathlib import Path
import time
import urllib.error
import urllib.request


def token(secret, role, expired=False):
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).rstrip(b'=')
    message = encode({'alg': 'HS256', 'typ': 'JWT'}) + b'.' + encode({
        'sub': '42', 'username': 'ws0-fixture', 'roles': [role],
        'exp': int(time.time()) + (-60 if expired else 300)})
    return (message + b'.' + base64.urlsafe_b64encode(
        hmac.new(secret.encode(), message, hashlib.sha256).digest()).rstrip(b'=')).decode()


def run(config_path):
    config = json.loads(config_path.read_text())
    if config.get('name') != 'obhl-security':
        raise ValueError('Only the disposable obhl-security project is allowed')
    services = config['services']
    for name, service in services.items():
        if service.get('container_name') != 'obhl-security-' + name:
            raise ValueError('Unexpected container identity')
        for port in service.get('ports', []):
            if port.get('host_ip') != '127.0.0.1':
                raise ValueError('All published ports must bind to loopback')
    env = services['api-gateway']['environment']
    secret = env['JWT_SECRET']
    internal = env['INTERNAL_SERVICE_KEY']
    records = []

    def check(label, port, path, method, headers, expected):
        url = f'http://127.0.0.1:{port}{path}'
        request = urllib.request.Request(url, method=method,
            data=None if method == 'GET' else b'{',
            headers={'Content-Type': 'application/json', **headers})
        # Never follow a redirect to a non-local destination.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None
        try:
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=10) as response:
                actual = response.status
        except urllib.error.HTTPError as error:
            actual = error.code
        except (OSError, TimeoutError) as error:
            actual = type(error).__name__
        passed = actual == expected
        records.append({'check': label, 'port': port, 'path': path, 'expected': expected, 'actual': actual, 'passed': passed})
        print(f'{"PASS" if passed else "FAIL"} {label}: {actual} (expected {expected})')

    credentials = [
        ('anonymous', {}, 401),
        ('user', {'Authorization': 'Bearer ' + token(secret, 'USER')}, 403),
        ('expired', {'Authorization': 'Bearer ' + token(secret, 'ADMIN', expired=True)}, 401),
        ('invalid', {'Authorization': 'Bearer invalid'}, 401),
        ('admin', {'Authorization': 'Bearer ' + token(secret, 'ADMIN')}, 400),
    ]
    targets = [
        (8000, '/api/v1/games'), (8002, '/api/v1/games'), (8080, '/games-api/games'),
        (8000, '/api/v1/stats/players'), (8003, '/api/v1/stats/players'), (8080, '/stats-api/stats/players'),
        (8000, '/api/v1/players'), (8003, '/api/v1/players'), (8080, '/stats-api/players'),
        (8000, '/api/v1/game-events'), (8002, '/api/v1/game-events'), (8080, '/games-api/game-events'),
    ]
    for port, path in targets:
        for label, headers, expected in credentials:
            check(label, port, path, 'POST', headers, expected)
    for port, path in [(8002, '/api/v1/games'), (8003, '/api/v1/players')]:
        check('backend credential', port, path, 'POST', {'X-Internal-Service-Key': internal}, 400)
        check('public old key', port, path, 'POST', {'X-Internal-Service-Key': 'obhl-internal-service-key-change-in-production'}, 401)
        check('JWT cannot impersonate backend', port, path, 'POST', {'Authorization': 'Bearer ' + token(secret, 'INTERNAL_SERVICE')}, 403)
    for port, path in [(8000, '/api/v1/games'), (8002, '/api/v1/games'), (8080, '/games-api/games'),
                       (8000, '/api/v1/players'), (8003, '/api/v1/players'), (8080, '/stats-api/players')]:
        check('public read', port, path, 'GET', {}, 200)
    # A browser cannot elevate its user token by supplying the backend header to a proxy.
    for port, path in [(8000, '/api/v1/players'), (8080, '/stats-api/players')]:
        check('proxy never elevates caller', port, path, 'POST',
              {'Authorization': 'Bearer ' + token(secret, 'USER'), 'X-Internal-Service-Key': internal}, 403)
    return records


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('compose_json', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = run(args.compose_json)
    if args.report:
        args.report.write_text(json.dumps(result, indent=2) + '\n')
    passed = sum(item['passed'] for item in result)
    print(f'{passed}/{len(result)} checks passed')
    raise SystemExit(0 if passed == len(result) else 1)
