#!/usr/bin/env python3
"""Authenticate as an OBHL admin, publish a recap, and verify the public read."""
import argparse
import datetime
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


class GenerationError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def site_url(value, allow_local=False):
    url = urllib.parse.urlsplit(value.strip())
    local = allow_local and url.hostname in ('localhost', '127.0.0.1', '::1')
    if not url.hostname or (url.scheme != 'https' and not (url.scheme == 'http' and local)):
        raise GenerationError('Configure an HTTPS OBHL_SITE_URL (local HTTP requires --allow-local).')
    if url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise GenerationError('OBHL_SITE_URL must be a site origin, without credentials, path, query, or fragment.')
    return urllib.parse.urlunsplit((url.scheme, url.netloc, '', '', ''))


def season_id(value):
    if not value.isascii() or not value.isdecimal() or int(value) < 1 or int(value) > 9223372036854775807:
        raise GenerationError('Season ID must be a positive integer.')
    return int(value)


def api(origin, method, path, body=None, token=None):
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(origin + '/api/v1' + path,
        data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Do not print response bodies: authentication responses can contain credentials/tokens.
        hints = {401: 'Check the admin credentials or session.', 403: 'An active ADMIN account is required.',
                 404: 'Check the season ID and deploy the recap API first.',
                 409: 'The season must be completed before publishing.'}
        raise GenerationError(f'{method} {path} returned HTTP {error.code}. ' + hints.get(error.code, 'The recap was not verified; inspect the server before retrying.')) from None
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise GenerationError(f'{method} {path} failed or returned invalid JSON. Check site availability.') from None


def generate(origin, identifier, username, password):
    if not username or not password:
        raise GenerationError('Set OBHL_RECAP_USERNAME and OBHL_RECAP_PASSWORD as secrets.')
    login = api(origin, 'POST', '/auth/login', {'usernameOrEmail': username, 'password': password})
    if not isinstance(login, dict) or login.get('mustChangePassword'):
        raise GenerationError('Complete the account’s initial password setup before using it for recaps.')
    token = login.get('token')
    if not isinstance(token, str) or not token:
        raise GenerationError('Sign-in did not return a usable session.')
    result = api(origin, 'POST', f'/seasons/{identifier}/recap/generate', token=token)
    if not isinstance(result, dict) or result.get('seasonId') != identifier or not result.get('generatedAt'):
        raise GenerationError('The server did not confirm a saved recap.')
    try:
        datetime.datetime.fromisoformat(result['generatedAt'].replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        raise GenerationError('The server returned an invalid publication timestamp.') from None
    public = api(origin, 'GET', f'/seasons/{identifier}/recap')
    if public != result:
        raise GenerationError('The published recap could not be verified through the public endpoint.')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--season-id')
    target.add_argument('--list-seasons', action='store_true', help='List season IDs and statuses without authentication')
    parser.add_argument('--allow-local', action='store_true', help='Permit loopback HTTP for local testing only')
    args = parser.parse_args()
    try:
        origin = site_url(os.environ.get('OBHL_SITE_URL', ''), args.allow_local)
        if args.list_seasons:
            seasons = api(origin, 'GET', '/seasons')
            if not isinstance(seasons, list):
                raise GenerationError('The server did not return a season list.')
            print(json.dumps([{'id': item.get('id'), 'name': item.get('name'), 'status': item.get('status')} for item in seasons], ensure_ascii=True, indent=2))
            return 0
        identifier = season_id(args.season_id)
        result = generate(origin, identifier, os.environ.get('OBHL_RECAP_USERNAME'), os.environ.get('OBHL_RECAP_PASSWORD'))
    except GenerationError as error:
        print(f'Recap generation failed: {error}', file=sys.stderr)
        return 1
    print(f'Season {identifier}: recap published and verified at {result["generatedAt"]}.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
