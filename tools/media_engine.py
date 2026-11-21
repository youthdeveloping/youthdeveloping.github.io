#!/usr/bin/env python3
"""Generate one sourced Korean IT article and a Naver-ready HTML draft.

The website article is published automatically by the GitHub Actions workflow.
Naver's official blog-writing API was retired, so this script only creates a
ready-to-paste draft for Naver; it does not automate browser login or posting.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTICLE_DIR = ROOT / "media" / "articles"
NAVER_DIR = ROOT / "media" / "naver-drafts"
INDEX_PATH = ARTICLE_DIR / "index.json"
KST = dt.timezone(dt.timedelta(hours=9))

FEEDS = [
    ("GitHub Blog", "https://github.blog/feed/", "개발·프로그래밍"),
    ("Cloudflare Blog", "https://blog.cloudflare.com/rss/", "인터넷·서비스"),
    ("Google Developers Blog", "https://developers.googleblog.com/feeds/posts/default?alt=rss", "개발·프로그래밍"),
    ("Mozilla Hacks", "https://hacks.mozilla.org/feed/", "브라우저·웹 기술"),
    ("Ubuntu Blog", "https://ubuntu.com/blog/feed", "컴퓨터·IT"),
    ("Python Insider", "https://blog.python.org/feeds/posts/default?alt=rss", "개발·프로그래밍"),
    ("Microsoft DevBlogs", "https://devblogs.microsoft.com/feed/", "컴퓨터·IT"),
]

CATEGORY_ROTATION = [
    "개발·프로그래밍", "컴퓨터·IT", "프로젝트 개발 일지",
    "실험·리뷰", "IT 뉴스·기술 분석", "인터넷·서비스",
    "보안·개인정보", "기술 심층 분석", "IT 랭킹·데이터",
    "IT 역사·아카이브",
]

def fetch(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "YouthDeveloperMediaBot/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()

def text_of(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return " ".join("".join(node.itertext()).split())

def parse_feed(name: str, url: str, category: str) -> list[dict]:
    try:
        root = ET.fromstring(fetch(url))
    except Exception as exc:
        print(f"[feed] {name}: unavailable ({exc})")
        return []
    found = []
    for item in root.findall(".//item"):
        title = text_of(item.find("title"))
        link = text_of(item.find("link"))
        desc = text_of(item.find("description"))
        pub = text_of(item.find("pubDate"))
        if title and link.startswith("http"):
            found.append({"source": name, "title": title, "url": link, "summary": desc[:1200], "published": pub, "feed_category": category})
    # Atom feeds
    ns = {"a": "http://www.w3.org/2005/Atom"}
    for entry in root.findall(".//a:entry", ns):
        title = text_of(entry.find("a:title", ns))
        summary = text_of(entry.find("a:summary", ns)) or text_of(entry.find("a:content", ns))
        link_node = entry.find("a:link[@rel='alternate']", ns) or entry.find("a:link", ns)
        link = link_node.get("href", "") if link_node is not None else ""
        published = text_of(entry.find("a:published", ns)) or text_of(entry.find("a:updated", ns))
        if title and link.startswith("http"):
            found.append({"source": name, "title": title, "url": link, "summary": summary[:1200], "published": published, "feed_category": category})
    return found[:8]

def call_model(items: list[dict], category: str, today: str) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY secret is missing. Add it in GitHub repository Settings > Secrets and variables > Actions.")
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
    prompt = {
        "date": today,
        "target_category": category,
        "source_material": items[:18],
        "requirements": [
            "Write a genuinely useful Korean-language IT media article, not a short news rewrite.",
            "Use original explanation, context, practical implications and balanced analysis.",
            "Only state facts supported by the supplied source material or stable general knowledge.",
            "Do not invent hands-on tests, benchmarks, interviews, quotes, dates, prices or product experiences.",
            "Clearly distinguish source-confirmed facts from analysis.",
            "Use source URLs as inline references and include a sources array with title and url.",
            "Do not copy source wording. Summarize in original language.",
            "Do not create fake urgency, keyword stuffing, fabricated statistics or repetitive filler.",
            "If the available sources do not support a useful article in the target category, choose the closest relevant category and explain the scope honestly.",
            "Return valid JSON only with keys: title, category, summary, intro, sections, conclusion, tags, sources.",
            "sections must be an array of 4 to 6 objects, each with heading and paragraphs (array of strings).",
            "Target a substantive article of roughly 1200-2200 Korean characters, excluding source list.",
            "Use a precise title, useful headings, and a concise summary. No markdown or HTML in text fields.",
            "Avoid medical, legal, financial or safety advice. This is a general IT publication."
        ]
    }
    body = json.dumps({
        "model": model,
        "temperature": 0.45,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "You are the editorial desk of YouthDeveloper, a careful Korean IT publication. Accuracy and source transparency are more important than novelty."},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}
        ]
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:1000]
        raise RuntimeError(f"OpenAI API error {exc.code}: {detail}") from exc
    content = result["choices"][0]["message"]["content"]
    article = json.loads(content)
    validate_article(article)
    return article

def validate_article(article: dict) -> None:
    required = ["title", "category", "summary", "intro", "sections", "conclusion", "tags", "sources"]
    missing = [key for key in required if key not in article]
    if missing:
        raise ValueError("Generated article is missing fields: " + ", ".join(missing))
    if not isinstance(article["sections"], list) or len(article["sections"]) < 3:
        raise ValueError("Article needs at least three sections.")
    if not isinstance(article["sources"], list) or not article["sources"]:
        raise ValueError("Article must include source references.")
    for source in article["sources"]:
        if not isinstance(source, dict) or not str(source.get("url", "")).startswith("http"):
            raise ValueError("Every source must include a valid URL.")
    for key in ("title", "summary", "intro", "conclusion"):
        if not isinstance(article[key], str) or not article[key].strip():
            raise ValueError(f"Invalid article field: {key}")

def esc(value: str) -> str:
    return html.escape(str(value), quote=True)

def render_article(article: dict, date: str, slug: str) -> str:
    sections = []
    for section in article["sections"]:
        paragraphs = "".join(f"<p>{esc(p)}</p>" for p in section.get("paragraphs", []) if str(p).strip())
        sections.append(f"<section><h2>{esc(section.get('heading', ''))}</h2>{paragraphs}</section>")
    sources = "".join(
        f'<li><a href="{esc(s["url"])}" target="_blank" rel="noopener noreferrer">{esc(s.get("title") or s["url"])}</a> <span>{esc(s.get("publisher", ""))}</span></li>'
        for s in article["sources"]
    )
    tags = " · ".join(esc(tag) for tag in article.get("tags", []))
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{esc(article['summary'])}"><meta name="robots" content="index,follow">
<link rel="canonical" href="https://youthdeveloping.github.io/media/articles/{esc(slug)}.html">
<title>{esc(article['title'])} | YouthDeveloper Media</title>
<style>
:root{{color-scheme:dark;--bg:#080b10;--panel:#101720;--line:#26313d;--text:#e9eff5;--muted:#9aa8b6;--accent:#72f0ad}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font:16px/1.9 Inter,Pretendard,"Noto Sans KR",sans-serif}}
header,main,footer{{width:min(850px,calc(100% - 36px));margin:auto}}header{{padding:26px 0;border-bottom:1px solid var(--line);font:700 13px ui-monospace,monospace;letter-spacing:.08em}}
header a{{color:var(--accent);text-decoration:none}}main{{padding:54px 0 80px}}.meta{{color:var(--accent);font:12px ui-monospace,monospace;letter-spacing:.08em}}
h1{{font-size:clamp(32px,6vw,54px);line-height:1.22;letter-spacing:-.045em;margin:16px 0}}
.summary{{font-size:19px;color:#c4d0dc;border-left:2px solid var(--accent);padding-left:18px;margin:26px 0 34px}}
article p{{color:#d0d9e2;margin:14px 0}}h2{{font-size:24px;margin:42px 0 12px;letter-spacing:-.03em}}
.sources{{margin-top:52px;padding:22px;background:var(--panel);border:1px solid var(--line)}}.sources li{{margin:8px 0}}a{{color:var(--accent)}}.tags{{color:var(--muted);font-size:13px;margin-top:28px}}
footer{{border-top:1px solid var(--line);padding:24px 0 40px;color:var(--muted);font-size:12px}}
</style></head><body>
<header><a href="/media/">YOUTHDEVELOPER MEDIA</a> / ORIGINAL IT JOURNAL</header>
<main><div class="meta">{esc(date)} · {esc(article['category'])}</div><h1>{esc(article['title'])}</h1>
<div class="summary">{esc(article['summary'])}</div><article><p>{esc(article['intro'])}</p>
{''.join(sections)}<h2>마무리</h2><p>{esc(article['conclusion'])}</p></article>
<div class="sources"><strong>참고 자료</strong><ol>{sources}</ol></div><div class="tags">태그: {tags}</div></main>
<footer>© {date[:4]} YouthDeveloper · 본문은 참고 자료를 바탕으로 자체 작성한 해설 콘텐츠입니다.</footer></body></html>"""

def render_naver(article: dict, date: str) -> str:
    chunks = [
        f"<p><b>{esc(article['category'])} | {esc(date)}</b></p>",
        f"<h1>{esc(article['title'])}</h1>",
        f"<p>{esc(article['summary'])}</p>",
        f"<p>{esc(article['intro'])}</p>",
    ]
    for section in article["sections"]:
        chunks.append(f"<h2>{esc(section.get('heading', ''))}</h2>")
        chunks.extend(f"<p>{esc(p)}</p>" for p in section.get("paragraphs", []) if str(p).strip())
    chunks.append(f"<h2>마무리</h2><p>{esc(article['conclusion'])}</p><h2>참고 자료</h2><ul>")
    chunks.extend(f'<li><a href="{esc(s["url"])}">{esc(s.get("title") or s["url"])}</a></li>' for s in article["sources"])
    chunks.append("</ul>")
    chunks.append("<p>이 글은 공개된 참고 자료를 바탕으로 YouthDeveloper가 자체적으로 정리한 콘텐츠입니다.</p>")
    return "\n".join(chunks)

def main() -> int:
    now = dt.datetime.now(KST)
    date = now.strftime("%Y-%m-%d")
    ARTICLE_DIR.mkdir(parents=True, exist_ok=True)
    NAVER_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    index = json.loads(INDEX_PATH.read_text("utf-8")) if INDEX_PATH.exists() else {"items": []}
    if any(item.get("date") == date for item in index.get("items", [])):
        print(f"[skip] An article for {date} already exists.")
        return 0

    day_number = now.date().toordinal()
    category = CATEGORY_ROTATION[day_number % len(CATEGORY_ROTATION)]
    entries = []
    for feed in FEEDS:
        entries.extend(parse_feed(*feed))
    # De-duplicate by URL and prefer recently published entries.
    unique = {entry["url"]: entry for entry in entries}
    entries = list(unique.values())[:24]
    if not entries:
        raise RuntimeError("No source feeds were reachable. Refusing to publish an unsourced article.")

    article = call_model(entries, category, date)
    title = re.sub(r"[^0-9a-zA-Z가-힣]+", "-", article["title"]).strip("-").lower()[:65] or "it-article"
    slug = f"{date}-{title}"
    article_path = ARTICLE_DIR / f"{slug}.html"
    naver_path = NAVER_DIR / f"{slug}.html"
    article_path.write_text(render_article(article, date, slug), encoding="utf-8")
    naver_path.write_text(render_naver(article, date), encoding="utf-8")
    index.setdefault("items", []).insert(0, {
        "date": date,
        "title": article["title"],
        "category": article["category"],
        "summary": article["summary"],
        "url": f"/media/articles/{slug}.html",
        "naverDraft": f"/media/naver-drafts/{slug}.html",
        "tags": article.get("tags", []),
    })
    index["items"] = index["items"][:180]
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[success] Generated: {article_path}")
    print(f"[success] Naver-ready draft: {naver_path}")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr)
        raise
