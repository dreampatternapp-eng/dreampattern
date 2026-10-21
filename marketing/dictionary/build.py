"""Builds the dream dictionary pages under site/dreams/ from symbols.json.

Run from the repo root:  python3 marketing/dictionary/build.py
Set APP_STORE_URL once the app is live so every page links to the App Store.
"""
import html
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
OUT = SITE / "dreams"
BASE = "https://dreampattern.app"
APP_STORE_URL = os.environ.get("APP_STORE_URL", "")

symbols = json.loads((Path(__file__).parent / "symbols.json").read_text())
by_slug = {s["slug"]: s for s in symbols}
e = html.escape


def cta():
    if APP_STORE_URL:
        action = f'<a class="button" href="{e(APP_STORE_URL)}">Download on the App Store</a>'
    else:
        action = '<p class="dim">Coming soon to the App Store.</p>'
    return (
        '<div class="card cta"><h2>Understand your own dreams</h2>'
        "<p>Every dream is personal. DreamPattern is a private dream journal for iPhone: "
        "speak your dream when you wake, get a reflective reading of what you saw, "
        "and see which symbols keep coming back over time.</p>"
        f"{action}</div>"
    )


def page(title, description, path, body):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} | DreamPattern</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{BASE}{path}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{BASE}/icon.png">
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header><img src="/icon.png" alt=""><a href="/">DreamPattern</a></header>
<main>
{body}
</main>
<footer>
<a href="/dreams/">Dream dictionary</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a>
<p>© 2026 DreamPattern</p>
</footer>
</body>
</html>
"""


def symbol_page(s):
    themes = "".join(f"<li><strong>{e(t)}.</strong> {e(d)}</li>" for t, d in s["themes"])
    questions = "".join(f"<li>{e(q)}</li>" for q in s["questions"])
    related = [by_slug[r] for r in s["related"] if r in by_slug]
    rel = "".join(f'<li><a href="/dreams/{r["slug"]}">{e(r["title"])}</a></li>' for r in related)
    faq = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": s["title"],
        "description": s["description"],
        "publisher": {"@type": "Organization", "name": "DreamPattern", "url": BASE},
    }
    body = f"""<p class="dim crumbs"><a href="/dreams/">Dream dictionary</a></p>
<h1>{e(s["title"])}</h1>
<p>{e(s["intro"])}</p>
<h2>Common themes</h2>
<ul>{themes}</ul>
<p class="dim">Dreams are personal, and no symbol has one fixed meaning. Treat these as starting points for your own reflection, not predictions.</p>
<h2>Questions to ask yourself</h2>
<ul>{questions}</ul>
{cta()}
{"<h2>Related dreams</h2><ul>" + rel + "</ul>" if rel else ""}
<script type="application/ld+json">{json.dumps(faq)}</script>"""
    return page(s["title"], s["description"], f"/dreams/{s['slug']}", body)


def index_page():
    items = "".join(
        f'<li><a href="/dreams/{s["slug"]}">{e(s["name"])}</a></li>'
        for s in sorted(symbols, key=lambda s: s["name"].lower())
    )
    body = f"""<h1>Dream dictionary</h1>
<p>What does it mean when you dream about teeth falling out, being chased or flying? Here are the most common dream themes, what people often connect them with, and questions to help you reflect on your own dream.</p>
<ul class="columns">{items}</ul>
{cta()}"""
    return page(
        "Dream dictionary: common dreams and what they can mean",
        "A guide to the most common dreams, from teeth falling out to being chased, with themes and questions to help you reflect on your own dreams.",
        "/dreams/",
        body,
    )


def main():
    OUT.mkdir(exist_ok=True)
    for s in symbols:
        (OUT / f"{s['slug']}.html").write_text(symbol_page(s))
    (OUT / "index.html").write_text(index_page())
    urls = ["/", "/dreams/"] + [f"/dreams/{s['slug']}" for s in symbols]
    sitemap = "".join(f"<url><loc>{BASE}{u}</loc></url>" for u in urls)
    (SITE / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sitemap}</urlset>\n'
    )
    (SITE / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
    print(f"Built {len(symbols)} pages")


if __name__ == "__main__":
    main()
