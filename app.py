import datetime
import html
import os
import re
import urllib.parse
from typing import Any, Dict, List

from bs4 import BeautifulSoup
import feedparser
from flask import Flask, jsonify, render_template, request
import requests

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache to be fast and respectful of upstream
_cached_data: Dict[str, Any] = {
    "data": None,
    "timestamp": None,
}
CACHE_TTL_SECONDS = 300  # 5 minutes default cache if not explicitly refreshing


def clean_html_content(raw_html: str) -> str:
    """Sanitizes and updates links to open in a new tab safely."""
    soup = BeautifulSoup(raw_html, "html.parser")
    for a in soup.find_all("a"):
        href = a.get("href", "")
        if href.startswith("/"):
            a["href"] = f"https://cloud.google.com{href}"
        a["target"] = "_blank"
        a["rel"] = "noopener noreferrer"
    return str(soup)


def generate_tweet_text(date_str: str, category: str, text_content: str, link: str) -> str:
    """Generates an engaging, character-limit-safe tweet text."""
    cat_emoji = {
        "Feature": "🚀",
        "Change": "🔄",
        "Changed": "🔄",
        "Deprecated": "⚠️",
        "Security": "🛡️",
        "Issue": "🛠️",
        "Announcement": "📢",
    }.get(category, "✨")

    prefix = f"{cat_emoji} #BigQuery update ({date_str}) [{category}]: "
    hashtags = "\n\n#GoogleCloud #DataEngineering #Cloud"
    
    # Twitter counts URLs as ~23 chars. Max tweet length is 280.
    max_text_len = 280 - len(prefix) - 24 - len(hashtags) - 5
    if max_text_len < 40:
        max_text_len = 100

    clean_text = " ".join(text_content.split())
    if len(clean_text) > max_text_len:
        clean_text = clean_text[: max_text_len - 3].rstrip() + "..."

    return f"{prefix}{clean_text}\n\n🔗 {link}{hashtags}"


def parse_feed_entries(feed_xml: bytes) -> Dict[str, Any]:
    """Parses the BigQuery Atom feed into structured entries and updates."""
    feed = feedparser.parse(feed_xml)
    entries: List[Dict[str, Any]] = []

    feed_info = {
        "title": feed.feed.get("title", "BigQuery - Release notes"),
        "link": feed.feed.get("link", "https://cloud.google.com/bigquery/docs/release-notes"),
        "updated": feed.feed.get("updated", datetime.datetime.now(datetime.timezone.utc).isoformat()),
    }

    for idx, entry in enumerate(feed.entries):
        title = entry.get("title", f"Release Note #{idx + 1}")
        link = entry.get("link", "https://cloud.google.com/bigquery/docs/release-notes")
        updated = entry.get("updated", "")
        entry_id = entry.get("id", f"entry-{idx}")

        raw_content = ""
        if "content" in entry and entry.content:
            raw_content = entry.content[0].value
        elif "summary" in entry:
            raw_content = entry.get("summary", "")

        soup = BeautifulSoup(raw_content, "html.parser")
        items: List[Dict[str, Any]] = []
        current_category = "Feature"
        current_elements: list = []

        for elem in soup.contents:
            if getattr(elem, "name", None) in ["h1", "h2", "h3", "h4"]:
                if current_elements:
                    sub_html = "".join(str(x) for x in current_elements)
                    sub_text = BeautifulSoup(sub_html, "html.parser").get_text(separator=" ", strip=True)
                    if sub_text:
                        item_id = f"{entry_id}-item-{len(items)}"
                        items.append({
                            "id": item_id,
                            "category": current_category,
                            "html": clean_html_content(sub_html),
                            "text": sub_text,
                            "tweet_text": generate_tweet_text(title, current_category, sub_text, link),
                        })
                    current_elements = []
                current_category = elem.get_text(strip=True) or "Update"
            else:
                if str(elem).strip():
                    current_elements.append(elem)

        if current_elements or not items:
            sub_html = "".join(str(x) for x in current_elements) if current_elements else raw_content
            sub_text = BeautifulSoup(sub_html, "html.parser").get_text(separator=" ", strip=True)
            item_id = f"{entry_id}-item-{len(items)}"
            items.append({
                "id": item_id,
                "category": current_category,
                "html": clean_html_content(sub_html),
                "text": sub_text,
                "tweet_text": generate_tweet_text(title, current_category, sub_text, link),
            })

        entries.append({
            "id": entry_id,
            "title": title,
            "date": title,
            "link": link,
            "updated": updated,
            "items": items,
            "item_count": len(items),
        })

    return {
        "feed_info": feed_info,
        "entries": entries,
        "total_entries": len(entries),
        "total_updates": sum(len(e["items"]) for e in entries),
    }


def fetch_release_notes(force_refresh: bool = False) -> Dict[str, Any]:
    """Fetches and parses the BigQuery release notes XML feed, utilizing caching."""
    now = datetime.datetime.now(datetime.timezone.utc)
    
    if (
        not force_refresh
        and _cached_data["data"] is not None
        and _cached_data["timestamp"] is not None
    ):
        elapsed = (now - _cached_data["timestamp"]).total_seconds()
        if elapsed < CACHE_TTL_SECONDS:
            return _cached_data["data"]

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; BigQueryReleaseNotesViewer/1.0)",
        "Accept": "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
    }

    try:
        response = requests.get(FEED_URL, headers=headers, timeout=12)
        response.raise_for_status()
        data = parse_feed_entries(response.content)
        data["fetched_at"] = now.strftime("%Y-%m-%d %H:%M:%S UTC")
        data["from_cache"] = False

        _cached_data["data"] = data
        _cached_data["timestamp"] = now
        return data
    except Exception as e:
        if _cached_data["data"] is not None:
            cached = dict(_cached_data["data"])
            cached["warning"] = f"Using cached data due to fetch failure: {str(e)}"
            cached["from_cache"] = True
            return cached
        raise RuntimeError(f"Failed to fetch BigQuery release notes feed: {str(e)}") from e


@app.route("/")
def index():
    """Main page route."""
    return render_template("index.html")


@app.route("/api/release-notes")
def api_release_notes():
    """API endpoint for fetching release notes JSON."""
    force_refresh = request.args.get("refresh", "").lower() in ["1", "true", "yes"]
    try:
        data = fetch_release_notes(force_refresh=force_refresh)
        return jsonify({
            "status": "success",
            "data": data,
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
        }), 500


OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_LOCAL_MODEL = os.environ.get("LOCAL_MODEL", "gemma2:2b")


@app.route("/api/ai/status")
def api_ai_status():
    """Checks if local Ollama daemon is reachable and lists available models."""
    try:
        res = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=2)
        if res.ok:
            data = res.json()
            models = [m.get("name") for m in data.get("models", [])]
            return jsonify({
                "status": "success",
                "connected": True,
                "host": OLLAMA_HOST,
                "default_model": DEFAULT_LOCAL_MODEL if DEFAULT_LOCAL_MODEL in models or not models else models[0],
                "models": models,
            })
    except Exception:
        pass

    return jsonify({
        "status": "offline",
        "connected": False,
        "host": OLLAMA_HOST,
        "default_model": DEFAULT_LOCAL_MODEL,
        "models": [],
        "instructions": "Run 'ollama serve' and 'ollama pull gemma2:2b' on your machine to activate local AI.",
    })


@app.route("/api/ai/generate", methods=["POST"])
def api_ai_generate():
    """Generates an AI-polished rewrite using a local Ollama model (e.g. Gemma, Llama)."""
    payload = request.get_json() or {}
    text = payload.get("text", "").strip()
    style = payload.get("style", "viral")
    custom_prompt = payload.get("custom_prompt", "").strip()
    model = payload.get("model") or DEFAULT_LOCAL_MODEL
    link = payload.get("link", "").strip()

    if not text:
        return jsonify({"status": "error", "message": "Text content is required."}), 400

    style_instructions = {
        "viral": "Make it engaging, punchy, with a compelling hook, 2-3 emojis, and key developer benefit.",
        "professional": "Make it concise, executive, and professional, highlighting technical and business impact.",
        "tldr": "Summarize into 1-2 ultra-clear bullet points highlighting the core update.",
        "eli5": "Explain in simple, plain English without heavy database jargon.",
        "custom": custom_prompt or "Rewrite and polish this release note cleanly.",
    }.get(style, "Make it engaging, punchy, and informative.")

    prompt = f"""You are an expert Google Cloud and BigQuery developer advocate.
Rewrite the following BigQuery release note update for a social post.

Style instruction: {style_instructions}

Source update:
\"\"\"
{text}
\"\"\"

STRICT RULES:
1. Keep the output under 240 characters (excluding link).
2. Include relevant hashtags: #BigQuery #GoogleCloud #DataEngineering
3. If a link is provided ({link}), include it at the end.
4. Output ONLY the final post text. Do NOT include preambles, explanations, or quotes.
"""

    try:
        res = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_predict": 150,
                },
            },
            timeout=25,
        )

        if not res.ok:
            return jsonify({
                "status": "error",
                "message": f"Ollama returned error status {res.status_code}: {res.text}",
            }), 502

        data = res.json()
        generated_text = data.get("response", "").strip()
        # Clean up any wrapping quotes
        if generated_text.startswith('"') and generated_text.endswith('"'):
            generated_text = generated_text[1:-1].strip()

        return jsonify({
            "status": "success",
            "text": generated_text,
            "model": model,
            "style": style,
        })

    except requests.exceptions.ConnectionError:
        return jsonify({
            "status": "error",
            "message": f"Cannot connect to Ollama at {OLLAMA_HOST}. Make sure Ollama is running (`ollama serve`).",
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            "status": "error",
            "message": "Ollama request timed out. Model might be busy or loading.",
        }), 504
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
        }), 500


@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "BigQuery Release Notes Viewer"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

