# Environment Configuration

**Development** (`.env.development`):
- Uses `http://localhost:8000/api/v1` for local development
- Proxies through Vite dev server

**Production** (`.env.production`):
- Uses relative URL `/api/v1`
- Proxied through nginx reverse proxy on production server

## Usage

The environment variable `VITE_API_URL` is automatically loaded based on the build mode:
- `npm run dev` → uses `.env.development`
- `npm run build` → uses `.env.production`

##Files
- `.env.development` - Development configuration (committed to repo)
- `.env.production` - Production configuration (committed to repo)
- `.env.example` - Example template (committed to repo)
- `.env.local` - Local overrides (NOT committed, gitignored)

## Code Usage

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
```

This ensures the app works in both environments without code changes.
