# domain.example.ext deployment (Debian/Ubuntu, Option B: uWSGI + Nginx)

This directory contains example configuration for the `domain.example.ext` deployment.
All files here are intended to be scoped to this domain only.

## Contents

- `nginx.conf`: Nginx server block for `domain.example.ext`.
- `ssl.conf`: TLS/SSL settings snippet included by `nginx.conf`.
- `uwsgi.ini`: uWSGI application configuration.
- `shovo-uwsgi.service`: systemd service file for uWSGI.

## Installation instructions

### 1. Create a service user and application directory

```bash
sudo useradd --system --home /opt/shovo --shell /usr/sbin/nologin shovo
sudo mkdir -p /opt/shovo
sudo chown shovo:shovo /opt/shovo
```

### 2. Deploy the application code

```bash
sudo rsync -a --delete /path/to/repo/ /opt/shovo/
sudo chown -R shovo:shovo /opt/shovo
```

### 3. Install OS dependencies

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip uwsgi uwsgi-plugin-python3 nginx
```

### 4. Create the Python virtualenv and install requirements

```bash
cd /opt/shovo/webapp
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Configure environment

Create `/etc/shovo.env` with the following contents:

```bash
OMDB_API_KEY=your_real_key
```

```bash
sudo chown root:shovo /etc/shovo.env
sudo chmod 640 /etc/shovo.env
```

### 6. Install uWSGI systemd unit

```bash
sudo cp /opt/shovo/domain.example.ext/shovo-uwsgi.service /etc/systemd/system/shovo-uwsgi.service
sudo systemctl daemon-reload
sudo systemctl enable --now shovo-uwsgi.service
```

### 7. Install Nginx site configuration

```bash
sudo cp /opt/shovo/domain.example.ext/ssl.conf /etc/nginx/snippets/ssl-domain.example.ext.conf
sudo cp /opt/shovo/domain.example.ext/nginx.conf /etc/nginx/sites-available/domain.example.ext
sudo ln -s /etc/nginx/sites-available/domain.example.ext /etc/nginx/sites-enabled/domain.example.ext
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Verify deployment

```bash
curl -I https://domain.example.ext
```

You should see HTTP 200 and the security headers from `nginx.conf`.

## Security notes

- uWSGI is bound to `127.0.0.1:8001`, so it is not exposed publicly.
- Security headers are set at the Nginx layer.
- TLS settings are isolated in `ssl.conf`.
- The database lives at `/opt/shovo/webapp/data.sqlite3` and should be writable only by the `shovo` user.

## TLS certificate paths

The `ssl.conf` file assumes Let's Encrypt certificates in:

- `/etc/letsencrypt/live/domain.example.ext/fullchain.pem`
- `/etc/letsencrypt/live/domain.example.ext/privkey.pem`

If your certificates live elsewhere, update `ssl.conf` accordingly before installing it into Nginx.
