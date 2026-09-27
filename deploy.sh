#!/bin/bash

# Web SSH Platform - Linux 部署脚本
# 支持 Ubuntu 20.04+ 和 CentOS 8+

set -e

echo "========================================"
echo "  Web SSH Platform - Linux Deployment"
echo "========================================"
echo ""

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo "Error: Cannot detect OS"
    exit 1
fi

echo "Detected OS: $OS $OS_VERSION"
echo ""

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root"
    exit 1
fi

# 安装 Node.js（如果未安装）
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        dnf install -y nodejs
    fi
else
    echo "Node.js already installed: $(node --version)"
fi

echo ""

# 安装 PM2（如果未安装）
if ! npm list -g pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
else
    echo "PM2 already installed"
fi

echo ""

# 创建专用用户
if ! id webssh &>/dev/null; then
    echo "Creating webssh user..."
    useradd -r -s /bin/bash -m -d /opt/web-ssh webssh || true
else
    echo "User webssh already exists"
fi

echo ""

# 项目目录设置
PROJECT_DIR="/opt/web-ssh"
echo "Setting up project directory: $PROJECT_DIR"

if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p $PROJECT_DIR
fi

# 确定当前脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Copying files from $SCRIPT_DIR to $PROJECT_DIR..."
cp -r $SCRIPT_DIR/backend $PROJECT_DIR/ || echo "Warning: backend copy failed"
cp -r $SCRIPT_DIR/public $PROJECT_DIR/ || echo "Warning: public copy failed"
cp $SCRIPT_DIR/package.json $PROJECT_DIR/ || echo "Warning: package.json copy failed"
cp $SCRIPT_DIR/.env.example $PROJECT_DIR/.env || echo "Warning: .env copy failed"
cp $SCRIPT_DIR/ecosystem.config.js $PROJECT_DIR/ || echo "Warning: ecosystem.config.js copy failed"

echo ""

# 安装依赖
echo "Installing dependencies..."
cd $PROJECT_DIR
npm install --production

echo ""

# 设置权限
echo "Setting up permissions..."
chown -R webssh:webssh $PROJECT_DIR
chmod -R 755 $PROJECT_DIR
mkdir -p $PROJECT_DIR/tmp $PROJECT_DIR/logs
chown -R webssh:webssh $PROJECT_DIR/tmp $PROJECT_DIR/logs

echo ""

# Systemd 服务
echo "Setting up systemd service..."
cp $SCRIPT_DIR/web-ssh.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable web-ssh.service

echo ""

# Nginx 配置（可选）
read -p "Do you want to configure Nginx reverse proxy? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing Nginx..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get install -y nginx
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        dnf install -y nginx
    fi

    echo "Copying Nginx config..."
    cp $SCRIPT_DIR/nginx.conf.example /etc/nginx/sites-available/web-ssh 2>/dev/null || \
    cp $SCRIPT_DIR/nginx.conf.example /etc/nginx/conf.d/web-ssh.conf

    echo "Enabling Nginx..."
    systemctl enable nginx
    systemctl restart nginx
    echo "Note: Please edit nginx config and replace 'ssh.example.com' with your domain"
fi

echo ""

# 生成加密密钥
read -p "Generate new ENCRYPT_KEY? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ENCRYPT_KEY=$(openssl rand -hex 16)
    echo "Generated ENCRYPT_KEY: $ENCRYPT_KEY"
    echo "ENCRYPT_KEY=$ENCRYPT_KEY" >> $PROJECT_DIR/.env
fi

echo ""

# 生成 SESSION_SECRET
read -p "Generate new SESSION_SECRET? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    SESSION_SECRET=$(openssl rand -base64 32)
    echo "Generated SESSION_SECRET: $SESSION_SECRET"
    echo "SESSION_SECRET=$SESSION_SECRET" >> $PROJECT_DIR/.env
fi

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit $PROJECT_DIR/.env to configure:"
echo "   - DEFAULT_USER and DEFAULT_PASSWORD"
echo "   - PORT and HOST settings"
echo ""
echo "2. Start the service:"
echo "   systemctl start web-ssh"
echo ""
echo "3. Check status:"
echo "   systemctl status web-ssh"
echo ""
echo "4. View logs:"
echo "   journalctl -u web-ssh -f"
echo ""
echo "5. Access the web interface:"
echo "   http://$(hostname -I | awk '{print $1}'):3000"
echo ""
