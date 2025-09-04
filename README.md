# Traveler's Companion

A web application that helps travelers find nearby services using their current location.

## Features

- Find nearby services including:
  - Laundry
  - Pharmacy
  - Supermarket
  - ATM
  - Hostel
  - Bus Stop
  - Landmarks
- Automatic location detection with fallback to Lima, Peru
- Sort results by distance, rating, or number of ratings
- Mobile-friendly responsive design
- Direct links to Google Maps for each location

## Prerequisites

- Python 3.7 or higher
- Google Maps API key with Places API enabled
- Node.js and npm (for development)

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd traveler_app
   ```

2. **Create a virtual environment** (recommended)
   ```bash
   # On Windows
   python -m venv venv
   .\venv\Scripts\activate
   
   # On macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   - Copy the example environment file:
     ```bash
     copy .env.example .env
     ```
   - Edit the `.env` file and add your Google Maps API key:
     ```
     GOOGLE_MAPS_API_KEY=your_actual_api_key_here
     ```

5. **Run the application**
   ```bash
   python app.py
   ```

6. **Open in browser**
   Visit `http://localhost:5000` in your web browser.

## Getting a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
4. Create credentials (API key)
5. Restrict the API key to your domain for production use
6. Copy the API key to your `.env` file

## Project Structure

```
traveler_app/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env                  # Environment variables (not in version control)
├── .env.example          # Example environment variables
├── README.md             # This file
├── static/
│   ├── css/
│   │   └── styles.css    # Custom styles
│   └── js/
│       └── app.js        # Frontend JavaScript
└── templates/
    └── index.html        # Main HTML template
```

## Development

To run in development mode with auto-reload:

```bash
# On Windows
set FLASK_APP=app.py
set FLASK_ENV=development
flask run

# On macOS/Linux
export FLASK_APP=app.py
export FLASK_ENV=development
flask run
```

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
