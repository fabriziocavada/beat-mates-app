#!/usr/bin/env python3
"""
Test get bookings after fix
"""

import requests
import json

BASE_URL = "https://beat-mates-app-1.preview.emergentagent.com/api"
headers = {'Content-Type': 'application/json'}

# Login with the user who just made a booking
login_data = {
    "email": "booktest1@dance.com",
    "password": "testpass123"
}

response = requests.post(f"{BASE_URL}/auth/login", json=login_data, headers=headers)
if response.status_code == 200:
    token = response.json()["access_token"]
    print("✅ Logged in successfully")
    
    # Get my bookings
    auth_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    
    response = requests.get(f"{BASE_URL}/bookings", headers=auth_headers)
    
    if response.status_code == 200:
        bookings = response.json()
        print(f"✅ Get Bookings successful: Found {len(bookings)} booking(s)")
        for booking in bookings:
            print(f"   Booking ID: {booking['id']}, Amount: ${booking['amount']}, Status: {booking['status']}")
    else:
        print(f"❌ Get Bookings failed: Status code {response.status_code}, Response: {response.text}")
else:
    print(f"❌ Login failed: Status code {response.status_code}")