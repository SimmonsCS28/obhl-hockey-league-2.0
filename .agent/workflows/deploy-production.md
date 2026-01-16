---
description: Deploy main branch to production AWS server
---

# Production Deployment Workflow

This workflow deploys the latest main branch code to the production AWS EC2 server.

## Steps

// turbo-all

1. SSH into production server and navigate to project directory
```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && pwd"
```

2. Pull latest code from main branch
```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && git pull origin main"
```

3. Stop current containers
```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && docker compose down"
```

4. Rebuild and start all containers
```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && docker compose up -d --build"
```

5. Verify containers are running
```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173 "cd obhl-hockey-league-2.0 && docker compose ps"
```

## Post-Deployment

- Frontend will be available at: http://44.193.17.173
- Allow 2-5 minutes for frontend build to complete
- Hard refresh browser (Ctrl+Shift+R) to see changes
- Test critical features after deployment
