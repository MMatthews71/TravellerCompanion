from flask import Flask, render_template, jsonify, request
import googlemaps
import os
import logging
from dotenv import load_dotenv
from datetime import datetime
import threading
import time
import webbrowser
import requests

# Disable Flask's noisy request logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# Load .env file
load_dotenv()

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable caching in dev

@app.after_request
def add_no_cache_headers(response):
    """Ensure templates and static files don’t get cached in dev"""
    if app.debug:
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# -----------------------------
# Google Maps setup
# -----------------------------
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

# Default fallback (Lima, Peru)
DEFAULT_LOCATION = {"lat": -12.046374, "lng": -77.042793}

@app.route("/")
def index():
    version = int(time.time()) if app.debug else 1
    return render_template("index.html", version=version)

# -----------------------------
# Nearby search
# -----------------------------
@app.route("/search")
def search():
    """
    Search nearby places with Google Maps Places API.
    Supports special handling for 'hostel' so we can include hotels/lodging.
    """
    try:
        lat = float(request.args.get("lat", DEFAULT_LOCATION["lat"]))
        lng = float(request.args.get("lng", DEFAULT_LOCATION["lng"]))
        keyword = request.args.get("keyword", "")

        results = []

        if keyword.lower() == "hostel":
            # ✅ For hostel searches, also include hotels/lodging
            categories = ["hostel", "hotel", "lodging"]
            for cat in categories:
                places_result = gmaps.places_nearby(
                    location=(lat, lng),
                    radius=1500,   # slightly bigger search radius
                    keyword=cat,
                )
                for place in places_result.get("results", []):
                    results.append({
                        "name": place.get("name", "N/A"),
                        "address": place.get("vicinity", "N/A"),
                        "rating": place.get("rating", "N/A"),
                        "total_ratings": place.get("user_ratings_total", 0),
                        "open_now": place.get("opening_hours", {}).get("open_now", False),
                        "place_id": place.get("place_id"),
                        "location": place.get("geometry", {}).get("location", {}),
                        "category": cat  # store category for filtering
                    })
        else:
            # ✅ Normal case — just one keyword
            places_result = gmaps.places_nearby(
                location=(lat, lng),
                radius=1000,
                keyword=keyword,
            )
            for place in places_result.get("results", []):
                results.append({
                    "name": place.get("name", "N/A"),
                    "address": place.get("vicinity", "N/A"),
                    "rating": place.get("rating", "N/A"),
                    "total_ratings": place.get("user_ratings_total", 0),
                    "open_now": place.get("opening_hours", {}).get("open_now", False),
                    "place_id": place.get("place_id"),
                    "location": place.get("geometry", {}).get("location", {}),
                    "category": keyword
                })

        return jsonify({"status": "success", "results": results})

    except Exception as e:
        print("❌ Search error:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# -----------------------------
# Place details (photos)
# -----------------------------
@app.route("/place-details")
def place_details():
    """Fetch photos for a place via Google Places Details API"""
    place_id = request.args.get("place_id")
    if not place_id:
        return jsonify({"status": "error", "message": "Missing place_id"}), 400

    try:
        details = gmaps.place(place_id=place_id, fields=["photo"])
        photos = []

        if "result" in details and "photos" in details["result"]:
            for photo in details["result"]["photos"][:5]:
                ref = photo.get("photo_reference")
                if ref:
                    photo_url = (
                        f"https://maps.googleapis.com/maps/api/place/photo"
                        f"?maxwidth=400&photoreference={ref}&key={GOOGLE_MAPS_API_KEY}"
                    )
                    photos.append(photo_url)

        return jsonify({"status": "ok", "photos": photos})

    except Exception as e:
        print("❌ Place details error:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# -----------------------------
# Reverse geocode (for location box)
# -----------------------------
@app.route("/reverse-geocode")
def reverse_geocode():
    lat = request.args.get("lat")
    lng = request.args.get("lng")
    if not lat or not lng:
        return jsonify({"status": "error", "message": "Missing coordinates"}), 400

    try:
        results = gmaps.reverse_geocode((lat, lng))
        if results:
            components = results[0].get("address_components", [])
            suburb = city = country = None
            for comp in components:
                if "sublocality" in comp["types"]:
                    suburb = comp["long_name"]
                if "locality" in comp["types"]:
                    city = comp["long_name"]
                if "country" in comp["types"]:
                    country = comp["long_name"]

            location_text = ", ".join([p for p in [suburb, city, country] if p])
            return jsonify({"status": "ok", "address": location_text})

        return jsonify({"status": "error", "message": "No address found"}), 404
    except Exception as e:
        print("❌ Reverse geocode error:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# -----------------------------
# Health check
# -----------------------------
@app.route("/health")
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()})

# -----------------------------
# Auto-open browser
# -----------------------------
if __name__ == "__main__":
    def open_browser_when_ready():
        url = "http://127.0.0.1:5000/health"
        for _ in range(50):
            try:
                resp = requests.get(url, timeout=0.5)
                if resp.status_code == 200:
                    webbrowser.open("http://127.0.0.1:5000", new=2)
                    return
            except Exception:
                pass
            time.sleep(0.2)

        try:
            webbrowser.open("http://127.0.0.1:5000", new=2)
        except Exception:
            pass

    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    app.run(debug=True, use_reloader=False, host="0.0.0.0", port=5000)
