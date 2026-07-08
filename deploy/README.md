# Deployment — maintenance page

`maintenance.html` is a self-contained "we'll be right back" page shown to visitors
whenever the site's frontend is unreachable — most importantly **during deploys**, when
the frontend container is stopped/rebuilding.

## How it works
The **host Nginx** (`oldbuzzardhockey.nginx`) terminates SSL and proxies `/` to the
frontend container on `localhost:8080`. When that upstream is down, Nginx would
normally return a raw `502 Bad Gateway`. Instead, the config now intercepts upstream
errors on `location /` and serves this static page:

```nginx
proxy_intercept_errors on;
error_page 502 503 504 =503 /maintenance.html;
```

The page is served straight from the **host filesystem** (`/var/www/obhl-maintenance/`),
so it works even when every container is down. It returns HTTP `503` (correct for a
temporary outage) and auto-refreshes every 30s, so visitors are dropped back onto the
real site as soon as the deploy finishes — no action needed on their part.

Only `location /` (the frontend) is affected. The `/api/`, `/games-api/`, and
`/stats-api/` proxies are left untouched, so API calls still return real error codes
rather than an HTML page.

## One-time setup on the prod host
```bash
sudo mkdir -p /var/www/obhl-maintenance
sudo cp deploy/maintenance.html /var/www/obhl-maintenance/maintenance.html

# Apply the updated host Nginx config (this repo's oldbuzzardhockey.nginx is the
# reference copy of the site's server block — update the live file to match), then:
sudo nginx -t && sudo systemctl reload nginx
```

## Updating the page later
```bash
sudo cp deploy/maintenance.html /var/www/obhl-maintenance/maintenance.html
# no nginx reload needed — it's a static file
```

## Notes
- Fully self-contained (inline CSS; fonts loaded from Google Fonts CDN with a
  system-font fallback). It does **not** depend on any container or app asset.
- This is an **automatic** fallback — it appears on any frontend outage, not just
  planned deploys. If you ever want a manual on/off "maintenance mode" that's distinct
  from real crashes, that'd be a follow-up (e.g. gate it behind a flag file the config
  checks). For now, a friendly page on any downtime is the goal.
