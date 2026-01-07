# Custom Domain Setup Guide: topcheddar.hockey

## Overview
This guide walks through setting up your custom domain `topcheddar.hockey` to point to your AWS EC2 instance, including SSL/TLS certificate configuration for HTTPS.

## Prerequisites
- ✅ AWS EC2 instance running (IP: 44.193.17.173)
- ✅ Domain name: topcheddar.hockey (purchased/owned)
- ⚠️ Access to domain registrar DNS settings

## Architecture Options

### Option 1: Simple DNS + Let's Encrypt (Recommended for now)
**Pros**: Simple, free SSL, works with existing setup
**Cons**: Manual certificate renewal every 90 days (can be automated)

### Option 2: AWS Route 53 + Certificate Manager + Load Balancer
**Pros**: AWS-managed, auto-renewal, scalable
**Cons**: Additional cost (~$18/month for ALB), more complex

**Recommendation**: Start with Option 1, migrate to Option 2 if you need scaling

---

## Option 1: DNS + Let's Encrypt (Simple Setup)

### Step 1: Configure DNS Records

Go to your domain registrar (e.g., GoDaddy, Namecheap, Google Domains) and add these DNS records:

```
Type    Name                Value               TTL
A       @                   44.193.17.173       300
A       www                 44.193.17.173       300
CNAME   api                 topcheddar.hockey   300
```

**What this does:**
- `topcheddar.hockey` → Your EC2 instance
- `www.topcheddar.hockey` → Your EC2 instance
- `api.topcheddar.hockey` → Your EC2 instance (optional, for API)

**Wait Time**: 5-60 minutes for DNS propagation

**Verify DNS propagation:**
```bash
# On your local machine
nslookup topcheddar.hockey
# Should return: 44.193.17.173
```

---

### Step 2: Install Certbot (Let's Encrypt)

SSH into your EC2 instance and install Certbot:

```bash
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173

# Install Certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Verify installation
certbot --version
```

---

### Step 3: Update Nginx Configuration

Before getting SSL certificate, update Nginx to serve your domain:

```bash
sudo nano /etc/nginx/sites-available/default
```

Update the `server_name` directive:

```nginx
server {
    listen 80;
    server_name topcheddar.hockey www.topcheddar.hockey;
    
    # ... rest of your existing config
}
```

Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### Step 4: Obtain SSL Certificate

Run Certbot to get a free SSL certificate:

```bash
sudo certbot --nginx -d topcheddar.hockey -d www.topcheddar.hockey
```

**Follow the prompts:**
1. Enter email address (for renewal notifications)
2. Agree to Terms of Service (Y)
3. Choose whether to redirect HTTP to HTTPS (Option 2 - Redirect)

**Certbot will automatically:**
- Obtain the certificate
- Update Nginx configuration for HTTPS
- Set up automatic renewal (via systemd timer)

---

### Step 5: Update Frontend URLs

Since you're now using a domain, update your frontend to use the domain instead of IP:

**Files to update:**
- `frontend/src/components/public/Home.jsx`
- `frontend/src/components/public/TeamsPage.jsx`
- `frontend/src/components/public/PlayersPage.jsx`
- `frontend/src/components/public/SeasonsPage.jsx`
- `frontend/src/components/public/StandingsPage.jsx`
- `frontend/src/components/ScheduleManager.jsx`
- `frontend/src/components/SchedulePage.jsx`
- `frontend/src/services/api.js`

**Replace:**
```javascript
// Old
http://44.193.17.173:8000/api/v1/...

// New
https://topcheddar.hockey:8000/api/v1/...
// Or better: Set up Nginx proxy to eliminate port numbers
```

---

### Step 6: Configure Nginx as Reverse Proxy (Optional but Recommended)

Update Nginx to proxy API requests, eliminating the need for port numbers in URLs:

```bash
sudo nano /etc/nginx/sites-available/default
```

Add this configuration:

```nginx
# HTTP -> HTTPS redirect (managed by Certbot)
server {
    listen 80;
    server_name topcheddar.hockey www.topcheddar.hockey;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name topcheddar.hockey www.topcheddar.hockey;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/topcheddar.hockey/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/topcheddar.hockey/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Frontend (static files from Docker)
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Gateway
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Now your URLs become:**
- Frontend: `https://topcheddar.hockey`
- API: `https://topcheddar.hockey/api/v1/...`

---

### Step 7: Update Frontend to Use Clean URLs

Update all fetch calls to use the domain without port numbers:

```javascript
// Before
'http://44.193.17.173:8000/api/v1/seasons'

// After
'https://topcheddar.hockey/api/v1/seasons'
// or just '/api/v1/seasons' (relative URL)
```

---

### Step 8: Update AWS Security Group

Ensure your EC2 Security Group allows HTTPS traffic:

**Add inbound rule:**
- Type: HTTPS
- Protocol: TCP
- Port: 443
- Source: 0.0.0.0/0 (anywhere)

Keep port 80 open for HTTP->HTTPS redirect.

---

### Step 9: Test SSL Certificate

After Certbot completes, test your SSL setup:

1. **Browser Test:**
   - Visit `https://topcheddar.hockey`
   - Check for green padlock icon
   - Certificate should show "Let's Encrypt"

2. **SSL Labs Test:**
   - Visit: https://www.ssllabs.com/ssltest/
   - Enter: topcheddar.hockey
   - Should get A or A+ rating

---

### Step 10: Set Up Auto-Renewal

Certbot automatically sets up a systemd timer for renewal. Verify it:

```bash
# Check renewal timer
sudo systemctl status certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run
```

Certificates will auto-renew before expiration (every 90 days).

---

## Option 2: AWS Route 53 + Certificate Manager (Advanced)

### Step 1: Set Up Route 53 Hosted Zone

1. **AWS Console** → Route 53 → Create hosted zone
2. **Domain name**: topcheddar.hockey
3. **Copy nameservers** (4 NS records)
4. **Update domain registrar** to use AWS nameservers

**Cost**: $0.50/month per hosted zone

---

### Step 2: Request SSL Certificate (ACM)

1. **AWS Console** → Certificate Manager → Request certificate
2. **Domain names**:
   - topcheddar.hockey
   - www.topcheddar.hockey
   - *.topcheddar.hockey (wildcard)
3. **Validation**: DNS validation
4. **Add CNAME records** to Route 53 (auto-populated by ACM)

**Wait**: 5-30 minutes for validation

**Cost**: Free

---

### Step 3: Create Application Load Balancer

1. **AWS Console** → EC2 → Load Balancers → Create
2. **Type**: Application Load Balancer
3. **Listeners**:
   - HTTP (80) → Redirect to HTTPS
   - HTTPS (443) → Forward to target group
4. **SSL Certificate**: Select your ACM certificate
5. **Target Group**: Your EC2 instance (port 80)

**Cost**: ~$18/month

---

### Step 4: Update Route 53 A Record

1. **Route 53** → Hosted zone → topcheddar.hockey
2. **Create A record**:
   - Name: @ (empty)
   - Type: A - IPv4 address
   - Alias: Yes
   - Alias target: Your ALB
3. **Create CNAME for www**:
   - Name: www
   - Type: CNAME
   - Value: topcheddar.hockey

---

## Comparison Summary

| Feature | Option 1 (Let's Encrypt) | Option 2 (AWS ALB) |
|---------|-------------------------|-------------------|
| **Cost** | $0 | ~$18/month |
| **SSL Renewal** | Auto (Certbot) | Auto (AWS) |
| **Setup Time** | 30 minutes | 2 hours |
| **Scalability** | Single instance | Multi-instance |
| **Complexity** | Simple | Complex |
| **Best For** | Small projects, MVP | Production, scaling |

---

## Troubleshooting

### DNS not resolving
```bash
# Check DNS propagation
nslookup topcheddar.hockey 8.8.8.8

# Flush local DNS cache (Windows)
ipconfig /flushdns
```

### Certificate errors
```bash
# Check Nginx config
sudo nginx -t

# View Certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Renew certificate manually
sudo certbot renew --force-renewal
```

### Mixed content errors (HTTP/HTTPS)
- Ensure all API calls use `https://`
- Check browser console for blocked resources
- Update CORS settings to allow HTTPS origin

---

## Next Steps

1. **Now**: Set up DNS records at your domain registrar
2. **Wait 5-60 min**: For DNS propagation
3. **Then**: Run Certbot to get SSL certificate
4. **Update**: Frontend URLs to use domain
5. **Rebuild & Deploy**: Frontend with new URLs
6. **Test**: Visit https://topcheddar.hockey

---

## Quick Start Commands

```bash
# 1. SSH to server
ssh -i "C:\Users\Simmo\obhl-key.pem" ubuntu@44.193.17.173

# 2. Install Certbot
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

# 3. Get certificate
sudo certbot --nginx -d topcheddar.hockey -d www.topcheddar.hockey

# 4. Test renewal
sudo certbot renew --dry-run

# 5. Check status
sudo systemctl status nginx
sudo systemctl status certbot.timer
```

---

## Post-Setup Checklist

- [ ] DNS records configured and propagated
- [ ] SSL certificate obtained and installed
- [ ] Nginx configured with HTTPS
- [ ] Frontend URLs updated to use domain
- [ ] AWS Security Group allows port 443
- [ ] Auto-renewal timer is active
- [ ] Site accessible via https://topcheddar.hockey
- [ ] HTTP redirects to HTTPS
- [ ] SSL Labs test shows A/A+ rating

---

## Maintenance

**Monthly:**
- Check certificate expiration: `sudo certbot certificates`

**Quarterly:**
- Review SSL Labs rating
- Update Nginx if needed

**As Needed:**
- Monitor auto-renewal logs: `/var/log/letsencrypt/`

---

## Support Resources

- **Let's Encrypt Docs**: https://letsencrypt.org/docs/
- **Certbot Docs**: https://certbot.eff.org/
- **Nginx Docs**: https://nginx.org/en/docs/
- **AWS Route 53 Docs**: https://docs.aws.amazon.com/route53/
