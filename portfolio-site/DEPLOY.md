# Deploying jason.cobblestonepos.com

One static HTML file on the VPS that already runs the CRM behind nginx. No build step, no Node process, nothing added to the POS site.

Everything below is run in the VS Code terminal connected to the VPS, except step 1.

---

## 1. DNS — do this first, it takes time to propagate

At whoever hosts DNS for `cobblestonepos.com`, add one record:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `jason` | *your VPS's public IP* | 300 (or automatic) |

Cloudflare: set the proxy to **DNS only** (grey cloud) until TLS works in step 5, then turn the orange cloud back on if you want it.

Check it from the VPS terminal:

```bash
dig +short jason.cobblestonepos.com
# should print your VPS IP
```

Don't move on until it does.

---

## 2. Put the file on the server

```bash
sudo mkdir -p /var/www/jason-portfolio
sudo chown -R $USER:$USER /var/www/jason-portfolio
```

Then in VS Code: open `/var/www/jason-portfolio` and drag `index.html` into it (or right-click the folder → Upload). Confirm:

```bash
ls -l /var/www/jason-portfolio/index.html
```

---

## 3. nginx server block

```bash
sudo nano /etc/nginx/sites-available/jason-portfolio
```

Paste:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name jason.cobblestonepos.com;

    root /var/www/jason-portfolio;
    index index.html;

    # one page; anything else falls back to it
    location / {
        try_files $uri $uri/ /index.html;
    }

    # the page changes when you republish — don't let browsers cache it for long
    location = /index.html {
        add_header Cache-Control "public, max-age=300, must-revalidate";
    }

    gzip on;
    gzip_types text/html text/css application/javascript image/svg+xml;

    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    access_log /var/log/nginx/jason-portfolio.access.log;
    error_log  /var/log/nginx/jason-portfolio.error.log;
}
```

Enable it and reload:

```bash
sudo ln -s /etc/nginx/sites-available/jason-portfolio /etc/nginx/sites-enabled/
sudo nginx -t          # must say "syntax is ok" and "test is successful"
sudo systemctl reload nginx
```

`nginx -t` failing means the file has a typo — fix it before reloading. A reload never drops the CRM's connections.

---

## 4. Check it over HTTP

```bash
curl -I http://jason.cobblestonepos.com
# HTTP/1.1 200 OK
```

Open it in a browser too. It should look exactly like the artifact version.

---

## 5. TLS

```bash
sudo certbot --nginx -d jason.cobblestonepos.com
```

Pick redirect-to-HTTPS when it asks. Certbot edits the server block above and sets up renewal. Verify:

```bash
sudo certbot renew --dry-run
curl -I https://jason.cobblestonepos.com
```

If certbot isn't installed: `sudo apt install certbot python3-certbot-nginx`.

---

## 6. Link the two sites

On **cobblestonepos.com**, in the footer or the About page:

```html
<a href="https://jason.cobblestonepos.com">About the founder</a>
```

The portfolio already links back to cobblestonepos.com in its footer.

---

## Updating the page later

The page is built from one source file, so an update is: rebuild, upload, done.

```bash
# on your machine, in the folder with build-site.py
python3 build-site.py         # writes site/index.html from portfolio/index.html
```

Then drag the new `index.html` into `/var/www/jason-portfolio` in VS Code, replacing the old one. No nginx reload needed. Hard-refresh (Ctrl+F5) to beat the 5-minute cache.

Keep republishing the artifact version too, so the link you've already shared stays current.

---

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| Browser shows the POS site or the CRM | Request isn't matching this server block | Check `server_name` spelling; `sudo nginx -T \| grep -A3 jason` shows what nginx actually loaded |
| 403 Forbidden | nginx can't read the file | `sudo chmod 644 /var/www/jason-portfolio/index.html` and `sudo chmod 755 /var/www/jason-portfolio` |
| 404 | File isn't where `root` points | `ls /var/www/jason-portfolio` |
| certbot fails to validate | DNS not propagated, or port 80 blocked | Re-run step 1's `dig`; confirm the firewall allows 80 and 443 (`sudo ufw status`) |
| Fonts don't load | The VPS blocks outbound, or the visitor does | Harmless — the page falls back to system fonts by design |

---

## Before you point anyone at it

- [ ] GitHub, LinkedIn and resume links are on the page (still missing — nothing links out yet)
- [ ] The README judge-model error in the evals repo is fixed, since the page will drive people to that repo
- [ ] `https://jason.cobblestonepos.com` loads on your phone, not just the desktop
