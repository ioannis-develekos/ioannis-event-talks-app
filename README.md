# BigQuery Release Notes & Social Tracker ⚡

A modern web application built with **Python Flask** and **plain vanilla HTML, CSS, and JavaScript** that live-fetches Google Cloud BigQuery release notes from the [official Atom feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml), parses them into structured updates with category tags, and allows you to select, customize, and Tweet about any update directly on **X (Twitter)**.

---

## 🌟 Key Features

1. **Live BigQuery Feed Parser & Ingestion**:
   - Parses the XML/Atom feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`) in real time.
   - Extracts release dates, category tags (`Feature`, `Change`, `Deprecated`, `Announcement`, `Security`, `Issue`), formatted HTML descriptions, and official doc links.
   - Built-in in-memory caching with forced cache-busting when requested.

2. **Interactive Refresh with Spinner Animation**:
   - Dedicated **"Refresh Feed"** button with dynamic spinner state.
   - Live timestamp indicator for last fetched update.

3. **Select & Tweet / Share on X**:
   - **1-Click Tweet**: Click "Tweet" on any update to open the Tweet composer prefilled with character-limit-safe text, hashtags, and documentation link.
   - **Multi-Select Digest**: Select multiple updates using the checkboxes and click "Compose Tweet from Selected" to generate a summary digest.
   - **Interactive Modal**: Edit the tweet text, toggle quick hashtags (`#BigQuery`, `#GoogleCloud`, `#DataEngineering`, `#SQL`), see real-time character counter (280-character limit), and view live X post preview.
   - **Clipboard Copy**: 1-click text copy for both individual updates and tweets with toast feedback.

4. **Search & Category Filtering**:
   - Instant search across dates, categories, and full text with `/` keyboard shortcut.
   - Category pill filters (`Features`, `Changes`, `Deprecated`, `Announcements`, etc.) with dynamic item counters.

5. **Clean & Responsive UI**:
   - Vanilla HTML5, CSS3, and ES6 JavaScript — zero heavy frontend frameworks.
   - Google Cloud & BigQuery inspired modern aesthetic with Light/Dark mode support.
   - Responsive on mobile, tablet, and desktop screens.

---

## 🛠️ Requirements & Environment Setup

This project uses **[uv](https://docs.astral.sh/uv/)** for fast Python environment and package management. `gh` (GitHub CLI) is also available.

### 1. Initialize Python Environment with `uv`

```bash
# Create virtual environment
uv venv

# Install dependencies from requirements.txt
uv pip install -r requirements.txt
```

### 2. Run the Application

```bash
# Start the Flask web server
uv run python app.py
```

The application will be accessible at:
👉 **`http://localhost:5000`**

---

## 📁 Project Structure

```
day-2-codelab-1/
├── app.py                     # Flask server with feed fetcher, parser & JSON API
├── requirements.txt           # Python package dependencies
├── README.md                  # Project documentation
├── templates/
│   └── index.html             # Vanilla HTML5 layout
└── static/
    ├── css/
    │   └── style.css          # Vanilla CSS: Themes, responsive layout, cards & modal
    └── js/
        └── app.js             # Vanilla JS: Feed fetching, tweet modal, filtering & state
```

---

## 🔌 API Endpoints

- `GET /`: Main web interface.
- `GET /api/release-notes`: Returns parsed release notes as JSON.
- `GET /api/release-notes?refresh=1`: Forces a live refresh from Google Cloud's Atom feed.
- `GET /health`: Service health check.
