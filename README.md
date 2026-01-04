# shovo

This repository now contains two utilities:

- `drivemap`: a drive blocks map display utility (original bash script).
- `webapp/`: the Shovo shared watchlist web app using Flask.

## Shovo shared watchlist web app

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
