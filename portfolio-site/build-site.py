#!/usr/bin/env python3
"""Build dist/ (the deployed static site) from src/.

src/index.html is the artifact-flavoured fragment: no doctype/head/body, since
the Claude artifact runtime supplies those. This wraps it in a full document
with meta tags. The other pages in src/ are already complete documents and are
copied through unchanged, as are style.css and resume.pdf.

    python3 build-site.py
"""
import pathlib, re, shutil, datetime

HERE = pathlib.Path(__file__).parent
SRC, OUT = HERE / "src", HERE / "dist"
CANONICAL = "https://jason.cobblestonepos.com/"
DESCRIPTION = ("Jason Dicken — prompt engineering and AI evaluation. 25 years running "
               "restaurants, now building and measuring the AI that works in them.")
OG_TITLE = "Jason Dicken — Prompt engineering & AI evaluation"
FAVICON = ("data:image/svg+xml,"
           "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
           "%3Crect width='32' height='32' rx='6' fill='%230F5C3F'/%3E"
           "%3Ctext x='16' y='22' font-family='Georgia,serif' font-size='18' "
           "font-weight='700' fill='%23fff' text-anchor='middle'%3EJD%3C/text%3E%3C/svg%3E")
RESET = ("""  <style>
    :root{color-scheme:light dark;padding-top:env(safe-area-inset-top,0px);"""
         """padding-bottom:env(safe-area-inset-bottom,0px)}
    body{margin:0}
    img{max-width:100%}
    [hidden]{display:none!important}
  </style>""")
PASSTHROUGH = ["style.css", "resume.pdf", "support-assistant.html", "crm.html"]


def wrap_index() -> str:
    src = SRC.joinpath("index.html").read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", src, re.S).group(1).strip()
    head, body = src.split("</style>", 1) if "</style>" in src else (src.split("<div", 1)[0], "<div" + src.split("<div", 1)[1])
    if "</style>" in src:
        head += "</style>"
    head = head.replace(f"<title>{title}</title>", "", 1).strip()
    today = datetime.date.today().isoformat()
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title} — Prompt engineering &amp; AI evaluation</title>
  <meta name="description" content="{DESCRIPTION}">
  <link rel="canonical" href="{CANONICAL}">
  <link rel="icon" href="{FAVICON}">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="{OG_TITLE}">
  <meta property="og:description" content="{DESCRIPTION}">
  <meta property="og:url" content="{CANONICAL}">
  <meta name="twitter:card" content="summary">
  <meta name="robots" content="index,follow">
  <!-- built {today} by build-site.py from src/index.html -->
{RESET}
  {head}
</head>
<body>
{body.lstrip(chr(10))}
</body>
</html>
"""


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    OUT.joinpath("index.html").write_text(wrap_index(), encoding="utf-8")
    for name in PASSTHROUGH:
        shutil.copy2(SRC / name, OUT / name)
    total = sum(p.stat().st_size for p in OUT.iterdir()) / 1024
    print(f"wrote {OUT} — {len(PASSTHROUGH)+1} files, {total:.1f} KB")
