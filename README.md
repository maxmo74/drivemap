# Shovo - Shared Watchlist Web App

A lightweight web app that lets anyone with the URL create a shared movie/show list. It
uses IMDB search results (including thumbnails) and fetches IMDB ratings.

To run it:

```bash
cd webapp
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open `http://localhost:5000` and share the room URL.

## Deployment documentation

Domain-scoped deployment configuration lives in `domain.example.ext/`. See
`domain.example.ext/README.md` for the uWSGI + Nginx setup on Debian/Ubuntu and the
associated TLS/security headers.
