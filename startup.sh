#!/bin/bash

# Web SSH Platform - Universal Startup Script
# Usage: bash startup.sh [start|stop|restart|status|logs]

set -e

APP_NAME="web-ssh-platform"
APP_DIR="/opt/web-ssh"
NODE_CMD="node"
USER="webssh"

echo "========================================"
echo "  $APP_NAME - Startup Manager"
echo "========================================"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root"
    exit 1
fi

case "${1:-help}" in
    start)
        echo "Starting $APP_NAME..."
        cd $APP_DIR
        sudo -u $USER $NODE_CMD backend/app.js &
        echo "Service started (PID: $!)"
        ;;
    stop)
        echo "Stopping $APP_NAME..."
        pkill -f "$NODE_CMD.*backend/app.js" || echo "Service not running"
        echo "Service stopped"
        ;;
    restart)
        echo "Restarting $APP_NAME..."
        pkill -f "$NODE_CMD.*backend/app.js" || true
        sleep 2
        cd $APP_DIR
        sudo -u $USER $NODE_CMD backend/app.js &
        echo "Service restarted (PID: $!)"
        ;;
    status)
        echo "Service Status:"
        if pgrep -f "$NODE_CMD.*backend/app.js" > /dev/null; then
            echo "  Status: Running"
            ps aux | grep "$NODE_CMD.*backend/app.js" | grep -v grep
        else
            echo "  Status: Stopped"
        fi
        ;;
    logs)
        echo "Showing last 50 lines of logs:"
        if [ -f "$APP_DIR/logs/combined.log" ]; then
            tail -50 $APP_DIR/logs/combined.log
        else
            echo "Log file not found"
        fi
        ;;
    logs-follow)
        echo "Following logs in real-time (Ctrl+C to exit):"
        if [ -f "$APP_DIR/logs/combined.log" ]; then
            tail -f $APP_DIR/logs/combined.log
        else
            echo "Log file not found"
        fi
        ;;
    *)
        echo "Usage: bash startup.sh [command]"
        echo ""
        echo "Commands:"
        echo "  start        - Start the service"
        echo "  stop         - Stop the service"
        echo "  restart      - Restart the service"
        echo "  status       - Show service status"
        echo "  logs         - Show recent logs"
        echo "  logs-follow  - Follow logs in real-time"
        echo ""
        echo "Examples:"
        echo "  sudo bash startup.sh start"
        echo "  sudo bash startup.sh status"
        echo "  sudo bash startup.sh logs-follow"
        ;;
esac
