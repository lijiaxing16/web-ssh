# Web SSH Platform - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Manual Installation](#manual-installation)
4. [Docker Deployment](#docker-deployment)
5. [Nginx Configuration](#nginx-configuration)
6. [Security](#security)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Linux server (Ubuntu 20.04+, CentOS 8+, Debian 11+)
- Root or sudo access
- 2GB RAM minimum, 4GB recommended
- 500MB disk space minimum
- Port 3000 available (or custom port)
- (Optional) Port 80/443 for Nginx

---

## Quick Start

### Ubuntu/Debian

```bash
sudo bash install-ubuntu.sh
```

### CentOS/RHEL

```bash
sudo bash install-centos.sh
```

### Universal Deployment Script

```bash
sudo bash deploy.sh
```

This script will:
- Detect your OS
- Install Node.js 20
- Install PM2
- Create webssh user
- Setup systemd service
- (Optional) Configure Nginx
- Generate encryption keys

---

## Manual Installation

### 1. Install Node.js 20

**Ubuntu/Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL:**

```bash
sudo dnf install -y nodejs
```

### 2. Clone or Copy Project

```bash
sudo mkdir -p /opt/web-ssh
sudo chown $USER:$USER /opt/web-ssh
cd /opt/web-ssh
# Copy project files here
```

### 3. Install Dependencies

```bash
npm install --production
```

### 4. Configure Environment

```bash
cp .env.example .env
nano .env
```

Edit these values:

```env
PORT=3000
HOST=0.0.0.0
DEFAULT_USER=admin
DEFAULT_PASSWORD=YourSecurePassword123
SESSION_SECRET=your_random_secret_here
ENCRYPT_KEY=0123456789abcdef0123456789abcdef
```

### 5. Setup Systemd Service

```bash
sudo cp web-ssh.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable web-ssh
sudo systemctl start web-ssh
```

### 6. Verify Installation

```bash
sudo systemctl status web-ssh
sudo journalctl -u web-ssh -f
```

Access: http://your-server-ip:3000

---

## Docker Deployment

### Using Docker Compose

```bash
# Create .env file
cp .env.example .env
nano .env

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f web-ssh

# Stop services
docker-compose down
```

### Build Custom Image

```bash
docker build -t web-ssh:latest .
docker run -d \
  -p 3000:3000 \
  -e DEFAULT_USER=admin \
  -e DEFAULT_PASSWORD=YourPassword \
  --name web-ssh-app \
  web-ssh:latest
```

---

## Nginx Configuration

### Basic Setup

```bash
# Copy Nginx config
sudo cp nginx.conf.example /etc/nginx/sites-available/web-ssh

# Create symlink
sudo ln -s /etc/nginx/sites-available/web-ssh /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### HTTPS with Let's Encrypt

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d ssh.example.com

# Update Nginx config with SSL paths
sudo nano /etc/nginx/sites-available/web-ssh

# Restart Nginx
sudo systemctl restart nginx
```

### Reverse Proxy without Nginx

If using only the Node.js app without Nginx, access directly:

```
http://your-server-ip:3000
```

---

## Security

### 1. Change Default Password

Edit `.env` file:

```env
DEFAULT_USER=admin
DEFAULT_PASSWORD=SuperSecurePassword123!@#
```

Restart service:

```bash
sudo systemctl restart web-ssh
```

### 2. Generate Strong Keys

```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Generate ENCRYPT_KEY
openssl rand -hex 16

# Add to .env
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPT_KEY=$(openssl rand -hex 16)" >> .env
```

### 3. Firewall Configuration

**UFW (Ubuntu):**

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Firewalld (CentOS):**

```bash
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

### 4. Limit IP Access

Add to Nginx config:

```nginx
location / {
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;
    
    proxy_pass http://127.0.0.1:3000;
    ...
}
```

### 5. Use HTTPS

Always use HTTPS in production. Use Let's Encrypt for free certificates.

---

## Maintenance

### Update Application

```bash
cd /opt/web-ssh
git pull origin main
npm install --production
sudo systemctl restart web-ssh
```

### View Logs

```bash
# Real-time logs
sudo journalctl -u web-ssh -f

# Last 100 lines
sudo journalctl -u web-ssh -n 100

# By date
sudo journalctl -u web-ssh --since "2024-01-01" --until "2024-01-02"
```

### Backup

```bash
# Backup config
sudo cp /opt/web-ssh/.env /opt/web-ssh/.env.backup

# Backup entire app
sudo tar -czf web-ssh-backup-$(date +%Y%m%d).tar.gz /opt/web-ssh
```

### Monitor Resources

```bash
# Check memory usage
ps aux | grep node

# Check open files
lsof -p $(pgrep -f 'node.*app.js')

# Check connections
ss -tlnp | grep 3000
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or change PORT in .env
PORT=3001
```

### Connection Refused

```bash
# Check service status
sudo systemctl status web-ssh

# Check logs
sudo journalctl -u web-ssh -n 50

# Check if port is listening
sudo ss -tlnp | grep 3000
```

### High Memory Usage

```bash
# Restart service
sudo systemctl restart web-ssh

# Check process info
ps aux | grep node

# Limit resources in systemd
sudo nano /etc/systemd/system/web-ssh.service
# Add:
# MemoryMax=512M
# MemoryHigh=256M
```

### SSH Connection Fails

- Verify SSH server is running on target host
- Check firewall rules on target host
- Verify username and password/key
- Check logs: `sudo journalctl -u web-ssh -f`

### File Upload Issues

- Increase `client_max_body_size` in Nginx (default 100M)
- Check disk space: `df -h`
- Check permissions: `ls -la /opt/web-ssh/tmp`

### Nginx Reverse Proxy Issues

```bash
# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx status
sudo systemctl status nginx

# View Nginx error log
sudo tail -f /var/log/nginx/error.log
```

---

## Performance Tuning

### Systemd Service

Edit `/etc/systemd/system/web-ssh.service`:

```ini
[Service]
CPUQuota=200%
MemoryLimit=2G
CPUAccounting=yes
MemoryAccounting=yes
```

### Nginx Tuning

```nginx
worker_processes auto;
worker_connections 10000;

http {
    keepalive_timeout 65;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

### Node.js Tuning

Add to systemd service:

```ini
Environment="NODE_OPTIONS=--max-old-space-size=512"
```

---

## PM2 Management

### Start with PM2

```bash
sudo npm install -g pm2
cd /opt/web-ssh
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u webssh --hp /opt/web-ssh
```

### PM2 Commands

```bash
pm2 list
pm2 logs
pm2 restart web-ssh-platform
pm2 stop web-ssh-platform
pm2 delete web-ssh-platform
```

---

## Production Checklist

- [ ] Change default password
- [ ] Generate strong SESSION_SECRET and ENCRYPT_KEY
- [ ] Setup HTTPS/SSL certificate
- [ ] Configure firewall rules
- [ ] Setup Nginx reverse proxy
- [ ] Enable systemd service auto-start
- [ ] Setup log rotation
- [ ] Configure backup strategy
- [ ] Setup monitoring/alerting
- [ ] Document access procedures
- [ ] Setup audit logging
- [ ] Test disaster recovery

---

## Support

For issues or questions:
1. Check logs: `sudo journalctl -u web-ssh -f`
2. Review this guide
3. Check GitHub issues
4. Contact support

---

## License

MIT
