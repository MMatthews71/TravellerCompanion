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
    """Ensure templates and static files don't get cached in dev"""
    if app.debug:
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# -----------------------------
# Google Maps setup
# -----------------------------
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
if not GOOGLE_MAPS_API_KEY:
    raise ValueError("GOOGLE_MAPS_API_KEY environment variable is required")

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

def create_place_data(place, search_category):
    """Helper function to create a standardized place data dictionary."""
    # Always use the search category as the primary category
    # Ignore the actual place types
    primary_category = search_category
    
    # Special handling: bakeries are classified as cafés
    if search_category == "bakery":
        primary_category = "cafe"

    return {
        "name": place.get("name", "N/A"),
        "address": place.get("vicinity", "N/A"),
        "rating": place.get("rating", "N/A"),
        "total_ratings": place.get("user_ratings_total", 0),
        "open_now": place.get("opening_hours", {}).get("open_now"),
        "place_id": place.get("place_id"),
        "location": place.get("geometry", {}).get("location", {}),
        "category": primary_category,
        "icon": place.get("icon"),
        "icon_base": place.get("icon_mask_base_uri"),
        "icon_bg": place.get("icon_background_color"),
        "price_level": place.get("price_level"),
        "types": place.get("types", [])
    }

# Default fallback (Lima, Peru)
DEFAULT_LOCATION = {"lat": -12.046374, "lng": -77.042793}

@app.route("/")
def index():
    version = int(time.time()) if app.debug else 1
    return render_template("index.html", version=version)

# -----------------------------
# Nearby search with simple categorization
# -----------------------------
@app.route("/search")
def search():
    """
    Search nearby places with Google Maps Places API.
    Classify everything by the search term used.
    """
    try:
        lat = float(request.args.get("lat", DEFAULT_LOCATION["lat"]))
        lng = float(request.args.get("lng", DEFAULT_LOCATION["lng"]))
        keyword = request.args.get("keyword", "")

        if not keyword:
            return jsonify({"status": "error", "message": "Keyword is required"}), 400

        results = []
        seen_place_ids = set()

        if keyword.lower() == "food":
            # Search order: Bakery → Café → Restaurant → Fast Food
            search_categories = [
                ("bakery", "cafe"),  # Bakeries become cafés
                ("cafe", "cafe"),
                ("restaurant", "restaurant"),
                ("fast food", "fast_food")
            ]
            
            for search_keyword, result_category in search_categories:
                places_result = gmaps.places_nearby(
                    location=(lat, lng),
                    radius=2000,
                    keyword=search_keyword
                )
                for place in places_result.get("results", []):
                    pid = place.get("place_id")
                    if pid:
                        if pid in seen_place_ids:
                            # Update existing entry with new category
                            for i, result in enumerate(results):
                                if result.get("place_id") == pid:
                                    results[i] = create_place_data(place, result_category)
                                    break
                        else:
                            results.append(create_place_data(place, result_category))
                            seen_place_ids.add(pid)

        elif keyword.lower() == "supermarket":
            # Search order: Local Market → Convenience Store → General Store → Supermarket
            search_categories = [
                ("local market", "local_market"),
                ("convenience store", "convenience_store"),
                ("general store", "general_store"),
                ("supermarket", "supermarket")
            ]
            
            for search_keyword, result_category in search_categories:
                places_result = gmaps.places_nearby(
                    location=(lat, lng),
                    radius=2000,
                    keyword=search_keyword
                )
                for place in places_result.get("results", []):
                    pid = place.get("place_id")
                    if pid:
                        if pid in seen_place_ids:
                            # Update existing entry with new category
                            for i, result in enumerate(results):
                                if result.get("place_id") == pid:
                                    results[i] = create_place_data(place, result_category)
                                    break
                        else:
                            results.append(create_place_data(place, result_category))
                            seen_place_ids.add(pid)

        elif keyword.lower() == "pharmacy":
            # Search order: Pharmacy → Hospital
            search_categories = [
                ("pharmacy", "pharmacy"),
                ("hospital", "hospital")
            ]
            
            for search_keyword, result_category in search_categories:
                places_result = gmaps.places_nearby(
                    location=(lat, lng),
                    radius=2000,
                    keyword=search_keyword
                )
                for place in places_result.get("results", []):
                    pid = place.get("place_id")
                    if pid:
                        if pid in seen_place_ids:
                            # Update existing entry with new category
                            for i, result in enumerate(results):
                                if result.get("place_id") == pid:
                                    results[i] = create_place_data(place, result_category)
                                    break
                        else:
                            results.append(create_place_data(place, result_category))
                            seen_place_ids.add(pid)

        elif keyword.lower() == "hostel":
            # Search order: Accommodation → B&B → Hotels → Hostels
            search_categories = [
                ("accommodation", "lodging"),
                ("bed and breakfast", "bed_and_breakfast"),
                ("hotel", "hotel"),
                ("hostel", "hostel")
            ]
            
            for search_keyword, result_category in search_categories:
                places_result = gmaps.places_nearby(
                    location=(lat, lng),
                    radius=2000,
                    keyword=search_keyword
                )
                for place in places_result.get("results", []):
                    pid = place.get("place_id")
                    if pid:
                        if pid in seen_place_ids:
                            # Update existing entry with new category
                            for i, result in enumerate(results):
                                if result.get("place_id") == pid:
                                    results[i] = create_place_data(place, result_category)
                                    break
                        else:
                            results.append(create_place_data(place, result_category))
                            seen_place_ids.add(pid)

        elif keyword.lower() == "sim":
            # SIM card search - use first type from API response as category
            places_result = gmaps.places_nearby(
                location=(lat, lng),
                radius=2000,
                keyword="sim card"
            )
            for place in places_result.get("results", []):
                # Use the first type from the place's types list, or 'sim_card' as fallback
                category = place.get('types', ['sim_card'])[0] if place.get('types') else 'sim_card'
                results.append(create_place_data(place, category))

        else:
            # General search (laundry, atm, etc.) - classify by search term
            radius = 2000 if keyword.lower() in ["supermarket", "food", "restaurant"] else 1000

            places_result = gmaps.places_nearby(
                location=(lat, lng),
                radius=radius,
                keyword=keyword,
            )
            for place in places_result.get("results", []):
                results.append(create_place_data(place, keyword.lower()))

        return jsonify({"status": "success", "results": results})

    except ValueError as e:
        print(f"❌ Search parameter error: {e}")
        return jsonify({"status": "error", "message": "Invalid coordinates provided"}), 400
    except Exception as e:
        print(f"❌ Search error: {e}")
        return jsonify({"status": "error", "message": "Search service temporarily unavailable"}), 500

# -----------------------------
# Place details (photos + about info)
# -----------------------------
@app.route("/place-details")
def place_details():
    """Fetch details + photos for a place via Google Places Details API"""
    place_id = request.args.get("place_id")
    if not place_id:
        return jsonify({"status": "error", "message": "Missing place_id"}), 400

    try:
        details = gmaps.place(
            place_id=place_id,
            fields=[
                "photo",
                "editorial_summary",
                "price_level",
                "opening_hours",
                "website",
                "formatted_phone_number",
                "rating",
                "user_ratings_total"
            ]
        )

        result = details.get("result", {})
        photos = []
        
        # Process photos
        if "photos" in result:
            for photo in result["photos"][:6]:
                ref = photo.get("photo_reference")
                if ref:
                    photo_url = (
                        f"https://maps.googleapis.com/maps/api/place/photo"
                        f"?maxwidth=600&photoreference={ref}&key={GOOGLE_MAPS_API_KEY}"
                    )
                    photos.append(photo_url)

        # Build about info
        about_info = []
        
        if "editorial_summary" in result:
            summary = result["editorial_summary"].get("overview", "")
            if summary:
                about_info.append(f"📝 {summary}")

        if "price_level" in result and result["price_level"] is not None:
            levels = ["Free", "Inexpensive", "Moderate", "Expensive", "Very Expensive"]
            price_text = levels[result["price_level"]] if result["price_level"] < len(levels) else "N/A"
            about_info.append(f"💲 Price Level: {price_text}")

        if "website" in result:
            about_info.append(f"🌐 Website: {result['website']}")

        if "formatted_phone_number" in result:
            about_info.append(f"📞 Phone: {result['formatted_phone_number']}")

        # Enhanced opening hours formatter
        if "opening_hours" in result:
            hours = result["opening_hours"].get("weekday_text", [])
            if hours:
                formatted_hours = format_opening_hours(hours)
                about_info.append(formatted_hours)

        # Rating info
        if "rating" in result and "user_ratings_total" in result:
            rating = result["rating"]
            total = result["user_ratings_total"]
            about_info.append(f"⭐ {rating}/5 from {total} reviews")

        return jsonify({
            "status": "success", 
            "photos": photos, 
            "about": about_info
        })

    except Exception as e:
        print(f"❌ Place details error: {e}")
        return jsonify({"status": "error", "message": "Failed to load place details"}), 500

def format_opening_hours(hours_list):
    """Convert Google weekday_text into compact readable format."""
    try:
        day_map = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

        # Parse into tuples (day, hours_string)
        parsed = []
        for i, entry in enumerate(hours_list):
            try:
                _, hrs = entry.split(": ", 1)
            except ValueError:
                hrs = entry
            parsed.append((day_map[i], hrs))

        # Group consecutive days with the same hours
        groups = []
        for day, hrs in parsed:
            if not groups or groups[-1]["hours"] != hrs:
                groups.append({"days": [day], "hours": hrs})
            else:
                groups[-1]["days"].append(day)

        # Format groups compactly
        parts = []
        for g in groups:
            days = g["days"]
            if len(days) == 1:
                label = days[0]
            else:
                label = f"{days[0]}–{days[-1]}"
            parts.append(f"{label}: {g['hours']}")

        # Special simplifications
        if len(groups) == 1 and "Open 24 hours" in groups[0]["hours"]:
            return "🕒 Open 24/7"
        elif len(groups) == 1:
            return f"🕒 Daily: {groups[0]['hours']}"
        else:
            return "🕒 " + " | ".join(parts[:3])

    except Exception:
        return "🕒 Hours vary"

# -----------------------------
# Reverse geocode (for location display)
# -----------------------------
@app.route("/reverse-geocode")
def reverse_geocode():
    lat = request.args.get("lat")
    lng = request.args.get("lng")
    
    if not lat or not lng:
        return jsonify({"status": "error", "message": "Missing coordinates"}), 400

    try:
        lat, lng = float(lat), float(lng)
        results = gmaps.reverse_geocode((lat, lng))
        
        if results:
            components = results[0].get("address_components", [])
            suburb = city = country = None
            
            for comp in components:
                types = comp.get("types", [])
                if "sublocality" in types or "neighborhood" in types:
                    suburb = comp["long_name"]
                elif "locality" in types:
                    city = comp["long_name"]
                elif "country" in types:
                    country = comp["long_name"]

            # Build location string
            location_parts = [p for p in [suburb, city, country] if p]
            if not location_parts:
                location_text = f"{lat:.4f}, {lng:.4f}"
            else:
                location_text = ", ".join(location_parts)
            
            return jsonify({"status": "ok", "address": location_text})

        return jsonify({"status": "error", "message": "Address not found"}), 404
        
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid coordinates"}), 400
    except Exception as e:
        print(f"❌ Reverse geocode error: {e}")
        return jsonify({"status": "error", "message": "Geocoding service unavailable"}), 500

# -----------------------------
# Health check
# -----------------------------
@app.route("/health")
def health_check():
    return jsonify({
        "status": "healthy", 
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0"
    })

# -----------------------------
# Error handlers
# -----------------------------
@app.errorhandler(404)
def not_found(error):
    return jsonify({"status": "error", "message": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"status": "error", "message": "Internal server error"}), 500

# -----------------------------
# Auto-open browser (development only)
# -----------------------------
if __name__ == "__main__":
    def open_browser_when_ready():
        """Open browser once server is ready"""
        health_url = "http://127.0.0.1:5000/health"
        
        for attempt in range(50):
            try:
                resp = requests.get(health_url, timeout=1)
                if resp.status_code == 200:
                    print("🚀 Server ready! Opening browser...")
                    webbrowser.open("http://127.0.0.1:5000", new=2)
                    return
            except Exception:
                pass
            time.sleep(0.2)

        # Fallback - try to open anyway
        try:
            webbrowser.open("http://127.0.0.1:5000", new=2)
        except Exception:
            print("💡 Server running at http://127.0.0.1:5000")

    print("🧭 Starting Nomad Scout...")
    print("📍 Make sure your Google Maps API key is configured in .env")
    
    # Start browser opener in background
    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    
    # Run Flask app
    app.run(
        debug=True, 
        use_reloader=False,
        host="0.0.0.0", 
        port=5000
    )