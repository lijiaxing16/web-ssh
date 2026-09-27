# Web SSH Platform - Security Guide

## Overview

This document outlines security best practices for deploying and operating the Web SSH Platform in production environments.

## Authentication & Access Control

### 1. Strong Credentials

- Change default admin password immediately
- Use minimum 16 characters with mix of uppercase, lowercase, numbers, and symbols
- Rotate passwords every 90 days
- Do not share credentials via email or chat

### 2. Network Access

- Restrict access to trusted IP ranges only
- Use firewall rules to limit incoming connections
- Consider VPN or bastion host for remote access
- Disable public internet access if not needed

### 3. SSH Key Management

- Store SSH keys securely (encrypted)
- Never commit keys to version control
- Use key-based authentication where possible
- Rotate keys regularly
- Use passphrases on private keys

## Encryption

### 1. In Transit

- Always use HTTPS/TLS in production
- Use Let's Encrypt for free SSL certificates
- Configure strong cipher suites
- Enable HSTS (HTTP Strict Transport Security)

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 2. At Rest

- Sensitive data is encrypted using AES-256-GCM
- Store encryption keys in secure environment variables
- Never commit .env files to version control
- Use strong, randomly generated encryption keys

### 3. Session Management

- Sessions use httpOnly and secure cookies
- Session timeout: 30 minutes (configurable)
- CSRF protection enabled
- Session secrets generated using cryptographic randomness

## Infrastructure Security

### 1. Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Firewalld (CentOS)
sudo firewall-cmd --set-default-zone=drop
sudo firewall-cmd --permanent --add-port=22/tcp --zone=public
sudo firewall-cmd --permanent --add-port=80/tcp --zone=public
sudo firewall-cmd --permanent --add-port=443/tcp --zone=public
sudo firewall-cmd --reload
```

### 2. Operating System

- Keep OS updated: `sudo apt-get update && apt-get upgrade`
- Enable automatic security updates
- Disable unnecessary services
- Use SELinux or AppArmor if available
- Regular kernel updates

### 3. Service Isolation

- Run application as non-root user (webssh)
- Use systemd security options:

```ini
[Service]
User=webssh
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/web-ssh/tmp /opt/web-ssh/logs
```

## Application Security

### 1. Input Validation

- All user inputs are validated
- SSH hosts validated before connection
- File paths sanitized
- Commands executed with proper escaping

### 2. Dependency Management

- Audit dependencies: `npm audit`
- Update regularly: `npm update`
- Use package-lock.json for reproducible builds
- Scan for vulnerabilities: `npm audit --production`

### 3. Logging & Monitoring

- Connection attempts logged
- Failed authentications recorded
- Command execution can be audited
- Monitor resource usage
- Setup alerts for suspicious activity

## Best Practices

### 1. Configuration

```env
# .env file - NEVER commit this!
NODE_ENV=production
PORT=3000
HOST=127.0.0.1  # Only localhost, use Nginx for public
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPT_KEY=$(openssl rand -hex 16)
AUTH_ENABLED=true
DEFAULT_USER=admin
DEFAULT_PASSWORD=<strong-password>
SESSION_TTL=1800000  # 30 minutes
MAX_CONNECTIONS=20
```

### 2. Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name ssh.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/ssh.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ssh.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    location /api/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ssh.example.com;
    return 301 https://$server_name$request_uri;
}
```

### 3. Monitoring & Alerts

```bash
# Monitor failed logins
sudo journalctl -u web-ssh | grep -i error

# Monitor resource usage
watch -n 1 'systemctl status web-ssh | grep Memory'

# Monitor open connections
watch -n 1 'ss -tlnp | grep 3000'
```

### 4. Backup Strategy

```bash
# Daily backup
0 2 * * * tar -czf /backup/web-ssh-$(date +\%Y\%m\%d).tar.gz /opt/web-ssh/.env /opt/web-ssh/ecosystem.config.js

# Weekly full backup
0 3 * * 0 tar -czf /backup/web-ssh-full-$(date +\%Y\%w).tar.gz /opt/web-ssh

# Cleanup old backups (keep 30 days)
0 4 * * * find /backup -name 'web-ssh-*.tar.gz' -mtime +30 -delete
```

### 5. Audit Logging

Enable detailed logging:

```bash
# Check all logins
sudo journalctl -u web-ssh | grep -i "login\|connect\|disconnect"

# Export logs for analysis
sudo journalctl -u web-ssh --since 2024-01-01 --until 2024-01-02 > /tmp/web-ssh-logs.txt
```

## Incident Response

### If Compromised

1. **Immediate Actions**
   - Restart service: `sudo systemctl restart web-ssh`
   - Change all credentials
   - Revoke SSH keys
   - Review logs for suspicious activity

2. **Investigation**
   - Check audit logs
   - Review connection history
   - Identify compromised accounts
   - Check target system integrity

3. **Recovery**
   - Reset encryption keys
   - Reissue SSH credentials
   - Update firewall rules
   - Notify affected users
   - Deploy fixes

## Compliance

### Recommended for

- HIPAA: Use HTTPS, encrypt sensitive data, audit logging
- PCI-DSS: Strong authentication, encryption, monitoring
- SOC 2: Access control, logging, regular audits
- GDPR: Data minimization, encryption, audit trails

### Documentation

- Maintain security policy documentation
- Document all access procedures
- Keep audit logs for minimum 90 days
- Document incident response procedures
- Regular security assessments

## Additional Resources

- [OWASP Security Guidelines](https://owasp.org/)
- [CIS Benchmarks](https://www.cisecurity.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Linux Security Hardening](https://linux-audit.com/)

## Support

For security issues:
1. Do not disclose publicly
2. Report to security team
3. Include reproduction steps
4. Allow time for remediation

---

**Last Updated:** 2024
**Version:** 1.0
