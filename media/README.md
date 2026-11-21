# YouthDeveloper Media Automation

## What it does

- Runs once per day at 09:00 Korea Standard Time (00:00 UTC) through GitHub Actions.
- Collects recent items from public technology RSS/Atom feeds.
- Uses the OpenAI API to write one original Korean IT article with source links.
- Publishes the article to the static YouthDeveloper site by committing generated HTML and updating `media/articles/index.json`.
- Creates a separate HTML draft under `media/naver-drafts/` for review and manual publishing to Naver Blog.

## Required repository secret

The workflow requires an Actions secret named `OPENAI_API_KEY`.

Set it in the repository:
1. Open **Settings**.
2. Open **Secrets and variables → Actions**.
3. Choose **New repository secret**.
4. Name: `OPENAI_API_KEY`.
5. Value: an API key managed by the account owner.

API usage may incur charges. A billing-authorized adult or account administrator should review and manage the API account and spending limits. Do not put the key in source files, commits, or chat messages.

The model can be changed in `.github/workflows/media-daily.yml` using the `OPENAI_MODEL` environment variable.

## Naver Blog limitation

Naver officially retired its external Blog post-writing Open API on 2020-05-06. Naver's help center also identifies posts submitted through unauthorized automated tools such as macros or bots as abnormal service use. This project therefore does not automate Naver login, browser interaction, or posting through unofficial methods. It generates a Naver-ready HTML draft; a person must review and publish it in Naver Blog.

## Run and monitor

- Daily run: GitHub Actions → **YouthDeveloper Media Daily**.
- Manual run: GitHub Actions → **YouthDeveloper Media Daily** → **Run workflow**.
- Output articles: `media/articles/`.
- Naver-ready drafts: `media/naver-drafts/`.
- Dashboard: `/media/`.

The scheduled workflow is active only after this branch is merged into the repository's default branch and the required secret is configured. The first run should be started manually and checked in the Actions log before relying on the daily schedule.

## Editorial safeguards

The generator refuses to publish when no source feeds are reachable or no source links are included. It asks the model not to invent tests, benchmarks, interviews, quotes, dates, prices, or product experiences. Generated articles still require editorial review; automated text generation cannot guarantee factual accuracy.

## Automated checks

The daily workflow runs `python -m unittest discover -s tests -v` before generating an article. The tests cover Atom feed link selection and the requirement for source references. If a test fails, the workflow stops before publishing.
