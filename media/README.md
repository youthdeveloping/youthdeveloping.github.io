# YouthDeveloper Media Automation

## What it does

- Runs daily at 09:00 Korea Standard Time through GitHub Actions.
- Collects public RSS/Atom items from technology publishers.
- Builds a Korean daily IT briefing from feed titles and summaries.
- Publishes generated HTML to the YouthDeveloper website and updates the article index.
- Creates a separate Naver-ready HTML draft for a person to review and publish.

## Cost and requirements

This workflow does not call OpenAI or any other paid AI API. It requires no API key, billing account, repository secret, or external AI service. It uses Python's standard library and GitHub Actions. GitHub Actions usage remains subject to the account's included minutes and usage limits; check the repository/account usage page for current limits.

## Naver Blog limitation

Naver's external Blog post-writing API was retired. This project does not automate Naver login or use unofficial macros/bots to publish. It creates a ready-to-paste draft; a person must review and publish it in Naver Blog.

## Run and monitor

- Daily run: GitHub Actions → **YouthDeveloper Media Daily**.
- Manual run: GitHub Actions → **YouthDeveloper Media Daily** → **Run workflow**.
- Output articles: `media/articles/`.
- Naver drafts: `media/naver-drafts/`.
- Dashboard: `/media/`.

The scheduled workflow becomes active after this branch is merged into the repository's default branch. No API secret setup is needed.

## Editorial safeguards and limitations

The generator requires at least three source feed items and includes source links. It only uses titles and summaries supplied by those feeds; it does not claim to have independently tested products or verified details absent from the feeds. Some publishers provide short or incomplete feed summaries, so the result is a daily briefing rather than a deeply researched feature article. Review original sources before republishing, especially for security, compatibility, release dates, and product specifications.

## Automated checks

The workflow runs `python -m unittest discover -s tests -v` before generating an article. A failed test stops publication.
