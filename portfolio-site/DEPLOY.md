# Deploying jason.cobblestonepos.com

A small static **directory** on the VPS that already runs the CRM behind nginx. No Node process,
nothing added to the POS site.

The site is four files plus the PDF, built by `python3 build-site.py` into `portfolio-site/dist/`:

```
dist/index.html              the homepage
dist/support-assistant.html  case study: the evaluation
dist/crm.html                case study: the CRM agent fleet
dist/style.css               shared stylesheet — all three pages need it
dist/resume.pdf
```

Deploy the **whole `dist/` directory**. Uploading `index.html` alone leaves the case studies
and the stylesheet stale, and the homepage links straight to both.

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

Then in VS Code: open `/var/www/jason-portfolio` and drag the **contents of `dist/`** into it
(all five files, not the folder itself). Confirm:

```bash
ls -l /var/www/jason-portfolio
# index.html  support-assistant.html  crm.html  style.css  resume.pdf
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

    # real files first; unknown paths fall back to the homepage
    location / {
        try_files $uri $uri/ /index.html;
    }

    # the pages change when you rebuild — don't let browsers cache them for long
    location ~* \.(html|css)$ {
        add_header Cache-Control "public, max-age=300, must-revalidate";
    }

    # the PDF changes rarely
    location = /resume.pdf {
        add_header Cache-Control "public, max-age=86400";
        add_header Content-Disposition "inline; filename=\"jason-dicken-resume.pdf\"";
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
for p in / /support-assistant.html /crm.html /style.css /resume.pdf; do
  curl -o /dev/null -sw "%{http_code} %{content_type}  $p\n" http://jason.cobblestonepos.com$p
done
# 200 text/html … 200 text/css … 200 application/pdf
```

All five must be 200, and `resume.pdf` must come back as `application/pdf` — a browser's blank
PDF viewer does not prove the file is broken, so check the response and a download separately.

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

## Updating the site later

**Edit `src/`, never `dist/`.** `dist/` is regenerated and your edits there are silently
overwritten. The build also stamps the date into `dist/index.html`, so that file changes on
every rebuild even when nothing else did.

```bash
# on your machine, in portfolio-site/
python3 build-site.py         # writes dist/ from src/
```

Then drag the changed files from `dist/` into `/var/www/jason-portfolio` in VS Code, replacing
the old ones. If `style.css` changed, upload it too — all three pages share it. No nginx reload
needed. Hard-refresh (Ctrl+F5) to beat the 5-minute cache.

---

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| Browser shows the POS site or the CRM | Request isn't matching this server block | Check `server_name` spelling; `sudo nginx -T \| grep -A3 jason` shows what nginx actually loaded |
| 403 Forbidden | nginx can't read the file | `sudo chmod 644 /var/www/jason-portfolio/index.html` and `sudo chmod 755 /var/www/jason-portfolio` |
| 404 | File isn't where `root` points | `ls /var/www/jason-portfolio` |
| certbot fails to validate | DNS not propagated, or port 80 blocked | Re-run step 1's `dig`; confirm the firewall allows 80 and 443 (`sudo ufw status`) |
| Fonts don't load | The VPS blocks outbound, or the visitor does | Harmless — the page falls back to system fonts by design |
| Case study loads unstyled | `style.css` wasn't uploaded, or only `index.html` was | Upload the whole `dist/` contents |

---

## Before you point anyone at it

- [ ] All five files uploaded, not just `index.html`
- [ ] `https://jason.cobblestonepos.com` loads on your phone, not just the desktop
- [ ] The GitHub source links on the case study resolve — they point at
      `github.com/CobblestoneSolutions/cobblestone-ai-evals`, which must stay public and keep
      its current paths
- [ ] You have eyeballed `resume.pdf`: it is binary, the repo scanner cannot read it, and it
      carries whatever contact details you put in it
