# Web SSH Platform

A Linux-deployable web-based SSH and SFTP management tool with a modern dashboard, SSH terminal, file permissions, system metrics, and process control.

## Features

- SSH terminal access through browser
- SFTP file list, upload, download, directory creation, delete, rename
- File permission controls with chmod
- Private key file selection and paste support
- Real-time CPU, memory, disk, and system load monitoring
- Remote process monitoring and kill
- Beautiful dark dashboard UI
- Linux deployment ready via Node.js / PM2

## Tech Stack

- Node.js + Express
- ssh2 library for SSH and SFTP
- WebSocket for remote terminal communication
- Plain HTML/CSS/JS frontend for fast deployment

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start the service:

```bash
npm start
```

3. Open in browser:

```bash
http://localhost:3000
```

## Sample deployment on Linux

### With PM2

```bash
npm install -g pm2
pm2 start backend/app.js --name web-ssh
pm2 save
```

### Systemd service example

```ini
[Unit]
Description=Web SSH Platform
After=network.target

[Service]
WorkingDirectory=/opt/web-ssh
ExecStart=/usr/bin/node /opt/web-ssh/backend/app.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable web-ssh
sudo systemctl start web-ssh
```

## Security Notes

- Use SSH keys whenever possible
- Restrict network access to the web app
- Add authentication in front of the web UI for production
- Use reverse proxy (Nginx) for HTTPS and access control
- Consider limiting SSH commands and session lifetime

## Example usage

Connect to a Linux host using:
- Host: 192.168.1.10
- Port: 22
- Username: root
- Password or private key

Then you can:
- Run shell commands in the terminal
- Browse remote files using SFTP
- View CPU and memory usage
- Manage process lifecycle
- Set file permissions
