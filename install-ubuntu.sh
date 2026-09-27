#!/bin/bash

# Web SSH Platform - Ubuntu 快速安装脚本

set -e

echo "Web SSH Platform - Ubuntu Installation"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash install-ubuntu.sh"
    exit 1
fi

# 更新系统
echo "Updating system..."
apt-get update
apt-get upgrade -y

# 安装必要的工具
echo "Installing dependencies..."
apt-get install -y curl wget git build-essential

# 安装 Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 安装 Nginx
echo "Installing Nginx..."
apt-get install -y nginx

# 安装 PM2
echo "Installing PM2..."
npm install -g pm2

# 创建项目目录
echo "Creating project directory..."
mkdir -p /opt/web-ssh
cd /opt/web-ssh

# 创建用户
echo "Creating webssh user..."
useradd -r -s /bin/bash -m -d /opt/web-ssh webssh || true

# 权限设置
chown -R webssh:webssh /opt/web-ssh

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Clone or copy the web-ssh project to /opt/web-ssh"
echo "2. cd /opt/web-ssh"
echo "3. npm install --production"
echo "4. Copy web-ssh.service to /etc/systemd/system/"
echo "5. systemctl daemon-reload && systemctl enable web-ssh && systemctl start web-ssh"
echo ""
