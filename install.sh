#!/bin/bash

# LinguaDrill Installation Script for Ubuntu Server
# This script must be run as root

set -e  # Exit on any error

echo "=========================================="
echo "LinguaDrill Installation Script"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: This script must be run as root"
    echo "Please run: sudo bash install.sh"
    exit 1
fi

# Get OpenAI API Key
echo "Enter your OpenAI API Key:"
read -r OPENAI_API_KEY

if [ -z "$OPENAI_API_KEY" ]; then
    echo "ERROR: OpenAI API Key is required"
    exit 1
fi

# Get domain name (optional)
echo ""
echo "Enter your domain name (e.g., linguadrill.com) or press Enter to skip SSL setup:"
read -r DOMAIN_NAME

echo ""
echo "=========================================="
echo "Step 1: Installing system packages..."
echo "=========================================="

# Check if Node.js is already installed
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing Node.js 22 LTS..."

    # Remove any conflicting packages
    apt remove -y nodejs npm 2>/dev/null || true
    apt autoremove -y

    # Remove old NodeSource repository
    rm -f /etc/apt/sources.list.d/nodesource.list

    # Add Node.js 22 repository
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

    # Install Node.js (includes npm)
    apt update
    apt install -y nodejs
else
    echo "Node.js already installed"
fi

# Install other required packages
apt install -y git nginx certbot python3-certbot-nginx postgresql postgresql-contrib

# Verify Node.js installation
echo ""
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

echo ""
echo "=========================================="
echo "Step 2: Setting up PostgreSQL..."
echo "=========================================="

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE linguadrill;

-- Create user
CREATE USER linguadrill WITH PASSWORD 'linguadrill';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE linguadrill TO linguadrill;

-- Connect to database and grant schema privileges
\c linguadrill
GRANT ALL ON SCHEMA public TO linguadrill;
EOF

echo "PostgreSQL configured"

echo ""
echo "=========================================="
echo "Step 3: Cloning repository..."
echo "=========================================="

# Create directory and clone
mkdir -p /var/www
cd /var/www

# Remove existing directory if present
if [ -d "linguadrill" ]; then
    echo "Removing existing installation..."
    rm -rf linguadrill
fi

git clone https://github.com/Solifugus/linguadrill.git
cd linguadrill

echo ""
echo "=========================================="
echo "Step 4: Installing dependencies..."
echo "=========================================="

npm install

echo ""
echo "=========================================="
echo "Step 5: Initializing database schema..."
echo "=========================================="

# Initialize database tables
PGPASSWORD=linguadrill psql -U linguadrill -d linguadrill -f backend/init-db.sql

echo "Database schema created"

echo ""
echo "=========================================="
echo "Step 6: Importing language datasets..."
echo "=========================================="

# Check for languages.tar.gz in common locations
LANGUAGES_TAR=""
if [ -f "/root/languages.tar.gz" ]; then
    LANGUAGES_TAR="/root/languages.tar.gz"
elif [ -f "./languages.tar.gz" ]; then
    LANGUAGES_TAR="./languages.tar.gz"
elif [ -f "/tmp/languages.tar.gz" ]; then
    LANGUAGES_TAR="/tmp/languages.tar.gz"
fi

if [ -n "$LANGUAGES_TAR" ]; then
    echo "Found language datasets at: $LANGUAGES_TAR"
    echo "Extracting language datasets..."
    tar -xzf "$LANGUAGES_TAR"
    echo "✓ Language datasets imported"
else
    echo "No language datasets found (languages.tar.gz)"
    echo "You can:"
    echo "  1. Copy languages.tar.gz to /root/ and re-run this script"
    echo "  2. Generate datasets later with: npm run generate:v3"
    mkdir -p languages
fi

echo ""
echo "=========================================="
echo "Step 7: Creating configuration..."
echo "=========================================="

# Create config.json
cat > config.json <<EOF
{
  "openaiApiKey": "$OPENAI_API_KEY",
  "learnerLanguages": [
    "English",
    "Mandarin Chinese",
    "Hindi",
    "Spanish",
    "French",
    "Arabic",
    "Bengali",
    "Portuguese",
    "Russian",
    "Japanese",
    "Korean"
  ],
  "targetLanguages": [
    "Ukrainian",
    "Korean",
    "French"
  ],
  "languagesDir": "./languages",
  "iterationCount": 20,
  "wordsPerIteration": 10
}
EOF

echo "Configuration file created"

echo ""
echo "=========================================="
echo "Step 8: Creating systemd service..."
echo "=========================================="

# Create systemd service
cat > /etc/systemd/system/linguadrill.service <<EOF
[Unit]
Description=LinguaDrill Language Learning App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/linguadrill
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=linguadrill

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable linguadrill
systemctl start linguadrill

echo "Service created and started"

# Check service status
sleep 2
if systemctl is-active --quiet linguadrill; then
    echo "✓ LinguaDrill service is running"
else
    echo "✗ WARNING: LinguaDrill service failed to start"
    systemctl status linguadrill
fi

echo ""
echo "=========================================="
echo "Step 9: Configuring Nginx..."
echo "=========================================="

# Configure Nginx
cat > /etc/nginx/sites-available/linguadrill <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME:-_};

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/linguadrill /etc/nginx/sites-enabled/linguadrill

# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx

echo "Nginx configured and restarted"

echo ""
echo "=========================================="
echo "Step 10: Configuring firewall..."
echo "=========================================="

# Configure UFW firewall
ufw --force enable
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw status

echo "Firewall configured"

# Setup SSL if domain provided
if [ -n "$DOMAIN_NAME" ]; then
    echo ""
    echo "=========================================="
    echo "Step 11: Setting up SSL certificate..."
    echo "=========================================="

    echo "Attempting to obtain SSL certificate for $DOMAIN_NAME"
    echo "Make sure your domain is pointing to this server's IP!"
    echo ""
    echo "Press Enter to continue with SSL setup, or Ctrl+C to skip..."
    read -r

    certbot --nginx -d "$DOMAIN_NAME" -d "www.$DOMAIN_NAME" --non-interactive --agree-tos --register-unsafely-without-email || {
        echo "SSL setup failed. You can run this manually later:"
        echo "certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME"
    }
else
    echo ""
    echo "Skipping SSL setup (no domain provided)"
fi

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "LinguaDrill is now running!"
echo ""
if [ -n "$DOMAIN_NAME" ]; then
    echo "Access your application at: https://$DOMAIN_NAME"
else
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo "Access your application at: http://$SERVER_IP"
fi
echo ""
echo "Useful commands:"
echo "  - View logs: journalctl -u linguadrill -f"
echo "  - Restart service: systemctl restart linguadrill"
echo "  - Check status: systemctl status linguadrill"
echo "  - Generate language datasets: cd /var/www/linguadrill && npm run generate:v3"
echo ""
echo "IMPORTANT: To generate language datasets with audio, run:"
echo "  cd /var/www/linguadrill"
echo "  npm run generate:v3"
echo ""
echo "This will take 30-60 minutes per language pair."
echo ""
echo "=========================================="
