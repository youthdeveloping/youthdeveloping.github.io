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
        link_node = entry.find("a:link[@rel='alternate']", ns)
        if link_node is None:
            link_node = entry.find("a:link", ns)
        link = link_node.get("href", "") if link_node is not None else ""
        published = text_of(entry.find("a:published", ns)) or text_of(entry.find("a:updated", ns))
        if title and link.startswith("http"):
            found.append({"source": name, "title": title, "url": link, "summary": summary[:1200], "published": published, "feed_category": category})
    return found[:8]

def build_article(items: list[dict], category: str, today: str) -> dict:
    """Create a source-grounded daily briefing without a paid AI API."""
    ranked = sorted(items, key=lambda item: (bool(item.get('summary', '').strip()), item.get('published', '')), reverse=True)
    selected = ranked[:5]
    sections = []
    sources = []
    for item in selected:
        raw = re.sub(r'<[^>]+>', ' ', item.get('summary', ''))
        summary = html.unescape(' '.join(raw.split()))[:900]
        if not summary:
            summary = '이 피드 항목은 제목과 원문 링크만 제공하므로 세부 내용은 원문에서 확인해야 합니다.'
        paragraphs = [
            f"공식 피드에 공개된 제목은 ‘{item['title']}’입니다. {item['source']}가 제공한 피드 정보를 바탕으로 정리했습니다.",
            summary,
            '실제 적용 여부를 판단할 때는 발표 주체, 적용 대상, 제공 시점, 지원 조건을 원문에서 확인해야 합니다. 피드 요약에 없는 사양이나 성능 수치는 추정하지 않습니다.'
        ]
        if item.get('published'):
            paragraphs.insert(1, '피드 게시 시각: ' + item['published'])
        sections.append({'heading': item['title'], 'paragraphs': paragraphs})
        sources.append({'title': item['title'], 'url': item['url'], 'publisher': item['source']})
    if len(sections) < 3:
        raise RuntimeError('Fewer than three usable source items; refusing to publish a thin article.')
    return {
        'title': f'{today} 오늘의 IT 브리핑: 주요 기술 소식 {len(sections)}선',
        'category': 'IT 뉴스·기술 브리핑',
        'summary': f'공개 기술 RSS·Atom 피드에서 수집한 {len(sections)}개 소식을 출처와 함께 정리했습니다. 세부 사실과 적용 조건은 각 원문에서 확인할 수 있습니다.',
        'intro': 'YouthDeveloper가 기술 기업과 개발 커뮤니티의 공개 피드를 모아 오늘의 주요 소식을 정리했습니다. 이 브리핑은 피드에 제공된 제목과 요약을 기반으로 하며, 원문에 없는 테스트 결과나 세부 사실을 만들어내지 않습니다.',
        'sections': sections,
        'conclusion': '이번 브리핑은 공개 피드에서 확인할 수 있는 정보의 범위 안에서 작성했습니다. 제품 지원 여부, 배포 일정, 보안 영향, 기술 사양 등 중요한 사항은 연결된 공식 원문과 후속 공지를 기준으로 확인해 주세요.',
        'tags': ['IT뉴스', '기술브리핑', '개발', 'YouthDeveloper'],
        'sources': sources,
    }
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
    entries = list(unique.values())
    if not entries:
        raise RuntimeError("No source feeds were reachable. Refusing to publish an unsourced article.")

    article = build_article(entries, category, date)
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
