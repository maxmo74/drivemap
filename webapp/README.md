# Shared Watchlist Web App

This folder contains a lightweight Flask app for creating a shared movie/show list that is
shared by URL (no accounts required).

## Features
- Search IMDB titles with thumbnails and ratings.
- Live search suggestions while typing.
- Add/remove titles to a shared list stored by room ID.
- Toggle between watchlist and watched items.
- Mobile-friendly layout with responsive cards.
- Version badge is shown in the UI for quick verification.

## Running locally

```bash
cd webapp
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open `http://localhost:5000` and share the generated room URL.

## Notes
- Search results are sourced from IMDB's suggestion endpoint.
- Ratings are fetched from IMDB title pages and cached for one hour in SQLite.
