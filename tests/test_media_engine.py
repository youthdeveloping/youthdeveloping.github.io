import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import media_engine


class FeedParsingTests(unittest.TestCase):
    @patch("media_engine.fetch")
    def test_atom_alternate_link_is_selected(self, mocked_fetch):
        mocked_fetch.return_value = b"""<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Example technical update</title>
            <link rel="self" href="https://example.com/api/item"/>
            <link rel="alternate" href="https://example.com/article"/>
            <summary>Useful summary</summary>
            <updated>2026-11-21T00:00:00Z</updated>
          </entry>
        </feed>"""
        entries = media_engine.parse_feed("Example", "https://example.com/feed", "컴퓨터·IT")
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["url"], "https://example.com/article")
        self.assertEqual(entries[0]["title"], "Example technical update")

    @patch("media_engine.fetch")
    def test_atom_falls_back_to_first_link(self, mocked_fetch):
        mocked_fetch.return_value = b"""<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry><title>Fallback item</title>
          <link href="https://example.com/fallback"/>
          </entry>
        </feed>"""
        entries = media_engine.parse_feed("Example", "https://example.com/feed", "컴퓨터·IT")
        self.assertEqual(entries[0]["url"], "https://example.com/fallback")


class ArticleValidationTests(unittest.TestCase):
    def test_rejects_article_without_sources(self):
        article = {
            "title": "제목", "category": "컴퓨터·IT", "summary": "요약",
            "intro": "도입", "sections": [{"heading": "내용", "paragraphs": ["설명"]}],
            "conclusion": "결론", "tags": [], "sources": []
        }
        with self.assertRaises(ValueError):
            media_engine.validate_article(article)


if __name__ == "__main__":
    unittest.main()
