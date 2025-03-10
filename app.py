from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, date
import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
import uvicorn
from typing import Dict

# Define emission factors
EMISSION_FACTORS = {
    'car': 223.6,
    'bus': 515.2,
    'ev': 0,
    'bike': 26.6,
    'walk': 0
}

# Load environment variables
load_dotenv()

# Validate environment variables
required_env_vars = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD', 'DB_PORT']
for env_var in required_env_vars:
    if not os.getenv(env_var):
        raise ValueError(f'Missing required environment variable: {env_var}')

# Define data models with Pydantic
class TripCreate(BaseModel):
    category: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    visitdate: date
    transportMode: str
    status: str
    distance: Optional[float] = None
    actual_emissions: Optional[float] = None
    saved_emissions: Optional[float] = None
    ecoscore: Optional[float] = None
    
    class Config:
        from_attributes = True

class Trip(TripCreate):
    id: int
    created_at: datetime

# Initialize FastAPI app
app = FastAPI(title="EcoTracker API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Database connection
def get_db_connection():
    try:
        conn = psycopg2.connect(
            user=os.getenv('DB_USER'),
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT'),
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"Error connecting to the database: {e}")
        raise

# Initialize database
def initialize_database():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            DO $$
            BEGIN
                CREATE EXTENSION IF NOT EXISTS pgcrypto;

                CREATE TABLE IF NOT EXISTS trips (
                    id SERIAL PRIMARY KEY,
                    category TEXT NOT NULL,
                    location TEXT NOT NULL,
                    latitude FLOAT,
                    longitude FLOAT,
                    visitdate DATE NOT NULL,
                    transportMode TEXT NOT NULL,
                    status TEXT NOT NULL,
                    distance FLOAT,
                    actual_emissions FLOAT,
                    saved_emissions FLOAT,
                    ecoscore float,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            END $$;
        ''')
        conn.commit()
        print('Database initialized')
        update_trip_statuses()
    except Exception as error:
        print('Error initializing database:', error)
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

# Save trip
def save_trip(trip_data: Dict):
    conn = None
    cur = None
    try:
        # Calculate emissions and eco-score
        distance = float(trip_data.get('distance', 0))
        transport_mode = trip_data.get('transportMode', '').lower()
        
        # Prevent division by zero and handle missing mode
        if distance <= 0 or transport_mode not in EMISSION_FACTORS:
            raise ValueError(f"Invalid distance or transport mode: {distance}, {transport_mode}")
        
        # Calculate actual emissions
        threshold_emissions = 113  # kg/km
        actual_emission = (EMISSION_FACTORS.get(transport_mode, 0)) * distance
        max_emission_reference = EMISSION_FACTORS['bus'] * distance
        
        # Calculate emissions saved
        emissions_saved = max(0, (threshold_emissions - actual_emission / distance) * distance)
        
        # Calculate eco-score (0-100 scale)
        eco_score = max(0, min(100, 100 - (actual_emission / max_emission_reference) * 100))
        
        # Prepare trip data with calculated values
        trip_data['actual_emissions'] = actual_emission
        trip_data['saved_emissions'] = emissions_saved
        trip_data['ecoscore'] = eco_score
        
        # Default status to 'pending' if not provided
        trip_data['status'] = trip_data.get('status', 'pending')
        
        # Ensure required columns are present
        required_columns = [
            'category', 'location', 'latitude', 'longitude', 
            'visitdate', 'transportMode', 'status', 
            'distance', 'actual_emissions', 'saved_emissions', 'ecoscore'
        ]
        
        # Prepare the insert query dynamically
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Filter out any extra keys and ensure all required columns are present
        filtered_data = {k: trip_data.get(k) for k in required_columns}
        
        # Create the columns and values for the SQL query
        columns = ', '.join(filtered_data.keys())
        
        # Handle different data types for SQL insertion
        def format_value(value):
            if value is None:
                return 'NULL'
            elif isinstance(value, (int, float)):
                return str(value)
            elif isinstance(value, date):
                return f"'{value.isoformat()}'"
            else:
                return f"'{str(value)}'"
        
        values = ', '.join(format_value(filtered_data[col]) for col in filtered_data.keys())
        
        # Execute the insert query
        query = f"INSERT INTO trips ({columns}) VALUES ({values}) RETURNING *"
        cur.execute(query)
        
        # Fetch and return the inserted row
        result = dict(cur.fetchone())
        conn.commit()
        
        return result
    
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error saving trip: {e}")
        print(f"Trip data: {trip_data}")
        raise
    
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Get trips
def get_trips(status=None):
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = "SELECT * FROM trips"
        params = []
        
        if status:
            query += " WHERE status = %s"
            params.append(status)
            
        query += " ORDER BY created_at DESC"
        
        cur.execute(query, params)
        trips = [dict(row) for row in cur.fetchall()]
        return trips
    except Exception as e:
        print(f"Error getting trips: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Update trip statuses
def update_trip_statuses():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Update status to 'completed' for past trips
        cur.execute("""
            UPDATE trips
            SET status = 'completed'
            WHERE visitdate < CURRENT_DATE AND status = 'pending'

        """)
        
        conn.commit()
        print('Trip statuses updated')
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error updating trip statuses: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Clear data
def clear_data():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM trips")
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error clearing data: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Get total CO2 emissions saved
def get_total_co2_emissions_saved():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COALESCE(SUM(saved_emissions), 0) as total_saved FROM trips")
        result = cur.fetchone()
        return result['total_saved'] if result else 0
    except Exception as e:
        print(f"Error calculating total CO2 emissions saved: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Get net CO2 impact
def get_net_co2_impact():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                COALESCE(SUM(saved_emissions), 0) - COALESCE(SUM(actual_emissions), 0) as net_impact 
            FROM trips
        """)
        result = cur.fetchone()
        return result['net_impact'] if result else 0
    except Exception as e:
        print(f"Error calculating net CO2 impact: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Get total distance
def get_total_distance():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COALESCE(SUM(distance), 0) as total_distance FROM trips")
        result = cur.fetchone()
        return result['total_distance'] if result else 0
    except Exception as e:
        print(f"Error calculating total distance: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Get EcoScore
def get_ecoscore():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT AVG(ecoscore) as average_ecoscore FROM trips")
        result = cur.fetchone()
        return result['average_ecoscore'] if result and result['average_ecoscore'] is not None else 0
    except Exception as e:
        print(f"Error calculating EcoScore: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Get emissions by mode
def get_emissions_by_mode():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                transportMode, 
                COALESCE(SUM(actual_emissions), 0) as actual_emissions,
                COALESCE(SUM(saved_emissions), 0) as saved_emissions
            FROM trips 
            GROUP BY transportMode
        """)
        results = cur.fetchall()
        return [dict(row) for row in results]
    except Exception as e:
        print(f"Error getting emissions by mode: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Get visit date and EcoScore
def get_visit_date_and_ecoscore():
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                visitdate, 
                AVG(ecoscore) as ecoscore
            FROM trips 
            GROUP BY visitdate 
            ORDER BY visitdate
        """)
        results = cur.fetchall()
        return [dict(row) for row in results]
    except Exception as e:
        print(f"Error getting visit date and EcoScore: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# Routes
@app.get("/api/trips", response_model=List[Dict[str, Any]])
async def trips(status: Optional[str] = None):
    try:
        results = get_trips(status)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trips", response_model=Dict[str, Any])
async def create_trip(trip: TripCreate):
    try:
        # Convert Pydantic model to dictionary, excluding unset values
        trip_dict = trip.dict(exclude_unset=True)
        
        # Ensure distance is set (default to 0 if not provided)
        if 'distance' not in trip_dict or trip_dict['distance'] is None:
            # You might want to calculate distance based on location or set a default
            trip_dict['distance'] = 10.0  # Default distance
        
        result = save_trip(trip_dict)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/trips")
async def delete_trips():
    try:
        clear_data()
        return {"message": "All trips deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/emissions")
async def emissions():
    try:
        saved = get_total_co2_emissions_saved()
        net = get_net_co2_impact()
        return {
            "saved": saved,
            "net": net
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ecoscore")
async def ecoscore():
    try:
        score = get_ecoscore()
        return {"ecoscore": score}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trips/total-distance")
async def total_distance():
    try:
        distance = get_total_distance()
        return {"totalDistance": float(distance) if distance is not None else 0.0}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trips/counts")
async def trip_counts():
    try:
        all_trips = get_trips()
        counts = {'pending': 0, 'completed': 0}
        for trip in all_trips:
            if trip['status'] == 'pending':
                counts['pending'] += 1

            elif trip['status'] == 'completed':
                counts['completed'] += 1
        return counts

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/emissions-by-mode")
async def emissions_by_mode():
    try:
        data = get_emissions_by_mode()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/line-chart-data")
async def line_chart_data():
    try:
        data = get_visit_date_and_ecoscore()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Startup event
@app.on_event("startup")
def startup_event():
    initialize_database()

# Run the server
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=3000, reload=True)
