#!/bin/bash

# Web SSH Platform - Health Check Script
# Monitors service and restarts if needed

APP_NAME="web-ssh-platform"
APP_DIR="/opt/web-ssh"
PORT=${PORT:-3000}
HEALTH_URL="http://127.0.0.1:$PORT/api/health"
MAX_RETRIES=3

echo "[$(date)] Performing health check..."

# Check if service responds to health endpoint
for i in $(seq 1 $MAX_RETRIES); do
    response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        echo "[$(date)] Health check passed (HTTP $response)"
        exit 0
    else
        echo "[$(date)] Health check attempt $i failed (HTTP $response)"
        if [ $i -lt $MAX_RETRIES ]; then
            sleep 2
        fi
    fi
done

echo "[$(date)] Service is down, attempting restart..."
sudo systemctl restart web-ssh
sleep 3

# Verify restart
if curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL 2>/dev/null | grep -q "200"; then
    echo "[$(date)] Service restarted successfully"
    exit 0
else
    echo "[$(date)] Service restart failed"
    exit 1
fi
