#!/bin/bash

# Web SSH Platform - Cron Jobs Setup
# Run as: sudo bash cron-jobs.sh

echo "Setting up cron jobs for Web SSH Platform..."
echo ""

# Health check every 5 minutes
echo "Installing health check cron job..."
(crontab -l 2>/dev/null | grep -v "health-check.sh"; echo "*/5 * * * * /opt/web-ssh/health-check.sh >> /var/log/web-ssh-health.log 2>&1") | crontab -

# Daily backup at 2 AM
echo "Installing daily backup cron job..."
(crontab -l 2>/dev/null | grep -v "web-ssh-backup"; echo "0 2 * * * tar -czf /backup/web-ssh-\$(date +\%Y\%m\%d).tar.gz /opt/web-ssh/.env /opt/web-ssh/ecosystem.config.js >> /var/log/web-ssh-backup.log 2>&1") | crontab -

# Weekly full backup at 3 AM on Sunday
echo "Installing weekly full backup cron job..."
(crontab -l 2>/dev/null | grep -v "web-ssh-full-backup"; echo "0 3 * * 0 tar -czf /backup/web-ssh-full-\$(date +\%Y\%w).tar.gz /opt/web-ssh >> /var/log/web-ssh-backup.log 2>&1") | crontab -

# Cleanup old backups (keep 30 days)
echo "Installing backup cleanup cron job..."
(crontab -l 2>/dev/null | grep -v "web-ssh-cleanup"; echo "0 4 * * * find /backup -name 'web-ssh-*.tar.gz' -mtime +30 -delete") | crontab -

# Log rotation at 1 AM
echo "Installing log rotation cron job..."
(crontab -l 2>/dev/null | grep -v "web-ssh-logs"; echo "0 1 * * * gzip /opt/web-ssh/logs/*.log; find /opt/web-ssh/logs -name '*.log.gz' -mtime +30 -delete") | crontab -

echo ""
echo "Current cron jobs:"
crontab -l | grep web-ssh || echo "No web-ssh cron jobs found"
echo ""
echo "Cron jobs setup complete!"
