# Shovo Web App

This folder contains a lightweight Flask app for creating a shared movie/show list that is
shared by URL (no accounts required).

## Features
- Search IMDB titles with thumbnails and ratings.
- Add/remove titles to a shared list stored by room ID.
- Mobile-friendly layout with responsive cards.

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
