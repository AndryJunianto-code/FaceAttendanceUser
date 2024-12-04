# app.py
from flask import Flask, request, jsonify
import face_recognition
import numpy as np
import base64
import cv2
import os
from geopy.distance import geodesic
from flask_cors import CORS
from scipy.spatial import distance as dist
from mysql.connector import (connection)
from datetime import datetime, timedelta
from flask_socketio import SocketIO, emit


app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")  # Allow all origins
CORS(app)

class DatabaseHandler:
    def __init__(self, host, user, password, database):
        self.connection = connection.MySQLConnection(
            host=host,
            user=user,
            password=password,
            database=database,
            ssl_disabled=True 
        )
        self.cursor = self.connection.cursor(dictionary=True)

    def execute_query(self, query, params=None):
        try:
            self.cursor.execute(query, params or ())
            self.connection.commit()
            return self.cursor.lastrowid
        except Exception as e:
            print(f"Error executing query: {e}")
            return None

    def fetch_data(self, query, params=None):
        """Fetches data for SELECT queries."""
        self.cursor.execute(query, params or ())
        results = self.cursor.fetchall()
        return results

    def close_connection(self):
        """Close the database connection explicitly."""
        if self.connection.is_connected():
            self.cursor.close()
            self.connection.close()

db = DatabaseHandler(
    host='localhost',
    user='root',
    password='localhost@123',
    database='attendance_system'
)


# Existing face encoding loading, EAR calculation, and other utility functions
known_face_encodings = []
known_face_ids = []
dataset_folder = 'dataset_foto'

def load_face_data():
    for user_id in os.listdir(dataset_folder):
        user_folder_path = os.path.join(dataset_folder, user_id)
        if os.path.isdir(user_folder_path):
            image_path = os.listdir(user_folder_path)[0]
            image_full_path = os.path.join(user_folder_path, image_path)
            
            # Load the image and try to get face encodings
            face_image = face_recognition.load_image_file(image_full_path)
            face_encodings = face_recognition.face_encodings(face_image)
            
            # Check if at least one face encoding was found
            if face_encodings:
                face_encoding = face_encodings[0]
                known_face_encodings.append(face_encoding)
                known_face_ids.append(user_id)
            else:
                print(f"No face detected in image {image_path} for user {user_id}")
load_face_data()

def decode_image(image_b64):
    image_data = base64.b64decode(image_b64.split(',')[1])
    np_arr = np.frombuffer(image_data, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

def calculate_EAR(eye):
    A = dist.euclidean(eye[1], eye[5])
    B = dist.euclidean(eye[2], eye[4])
    C = dist.euclidean(eye[0], eye[3])
    ear = (A + B) / (2.0 * C)
    return ear

@app.route('/attendance', methods=['POST'])
def handle_attendance():
    data = request.get_json()
    image_b64 = data['image']
    """ user_location = data['geolocation'] """
    """ valid_location = (1.1141026, 104.0536873) """
    """ user_lat = user_location['lat']
    user_lng = user_location['lng'] """
    
    frame = decode_image(image_b64)
    face_locations = face_recognition.face_locations(frame)
    face_encodings = face_recognition.face_encodings(frame, face_locations)
    if len(face_encodings) == 0:
        return jsonify({'status': 'No face detected'}), 400

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blink_detected = False
    for face_encoding, (top, right, bottom, left) in zip(face_encodings, face_locations):
        matches = face_recognition.compare_faces(known_face_encodings, face_encoding)
        face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
        best_match_index = np.argmin(face_distances)

        if matches[best_match_index] and face_distances[best_match_index] < 0.4:
            user_id = known_face_ids[best_match_index]
            user_name =  db.fetch_data("SELECT name FROM staff WHERE user_id = %s", (user_id,))[0]['name']

            response = {'status' : f'{user_name} recognized. Checking for spoof...'}
            landmarks = face_recognition.face_landmarks(frame)
            for face_landmark in landmarks:
                left_eye = face_landmark["left_eye"]
                right_eye = face_landmark["right_eye"]
                if calculate_EAR(left_eye) < 0.28 and calculate_EAR(right_eye) < 0.28:
                    blink_detected = True
                    break
            if blink_detected:
                # Insert attendance into database
                date_today = datetime.now().strftime('%Y-%m-%d')
                time_now = datetime.now().strftime('%H:%M:%S')
                db.execute_query(
                    "INSERT INTO validation (user_id, date, time) VALUES (%s, %s, %s)",
                    (user_id, date_today, time_now)
                )
                socketio.emit('validation_update', {'message': 'Validation data updated!'})
                return jsonify({'status': 'Attendance Successful', 'user_id': user_id, 'name': user_name}), 200
            else:
                return jsonify({'status': 'Spoof detected.. Try to blink', 'user_id': user_id, 'name': user_name}), 400

    return jsonify({'status': 'fail'}), 400

""" @app.route('/get_status', methods=['POST'])
def get_status():
    data = request.get_json()
    user_id = data['user_id']
    
    # Retrieve statuses for today for the specified user_id
    today = datetime.now().strftime('%Y-%m-%d')
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT status FROM attendance WHERE user_id = ? AND date = ?", (user_id, today))
        results = cursor.fetchall()
        statuses = [record[0] for record in results]  # List of statuses for today

    return jsonify({'statuses': statuses}) """

# New endpoint to fetch pending validation record
@app.route('/validation', methods=['GET'])
def get_validation():
    rows = db.fetch_data("""
        SELECT v.id, v.user_id, s.name, v.date, v.time 
        FROM validation v
        JOIN staff s ON v.user_id = s.user_id
    """)
    validation_data = []
    for row in rows: 
        time = row['time']
        if isinstance(time, timedelta):
            time = str(time)
        
        validation_data.append({
            'id': row['id'],
            'user_id': row['user_id'],
            'name': row['name'],
            'date': row['date'],
            'time': time
        })
    return jsonify(validation_data)

@app.route('/validate_attendance', methods=['POST'])
def validate_attendance():
    data = request.get_json()
    record_id = data['id']
    status = data['status']  
    validated_time = datetime.now().strftime('%H:%M:%S')

    # Retrieve record from validation and move it to attendance
    record = db.fetch_data("SELECT user_id, date, time FROM validation WHERE id = %s", (record_id,))
    if record:
        user_id, date, time = record[0]['user_id'], record[0]['date'], record[0]['time']
        db.execute_query("""
            INSERT INTO attendance (user_id, date, time, status, validated_time)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, date, time, status, validated_time))
        db.execute_query("DELETE FROM validation WHERE id = %s", (record_id,))
        return jsonify({'status': f'Attendance marked as {status} for {user_id}'}), 200
    
    return jsonify({'status': 'User not found'}), 404

# Updated report endpoint to show attendance with status and validated time
@app.route('/report', methods=['GET'])
def get_report():
    rows = db.fetch_data("""
        SELECT a.user_id, s.name, a.date, a.time, a.status, a.validated_time
        FROM attendance a
        JOIN staff s ON a.user_id = s.user_id
    """)
    report_data = []
    for row in rows: 
        validated_time = row['validated_time']
        time = row['time']
        if isinstance(validated_time, timedelta):
            validated_time = str(validated_time)
            time = str(time)
        
        report_data.append({
            'user_id': row['user_id'],
            'name': row['name'],
            'date': row['date'],
            'time': time,
            'status': row['status'],
            'validated_time': validated_time
        })
    return jsonify(report_data)

if __name__ == '__main__':
    app.run(debug=True)
