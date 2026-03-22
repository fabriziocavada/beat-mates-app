#!/usr/bin/env python3
"""
Test the booking fix specifically
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "https://coaching-live-demo-1.preview.emergentagent.com/api"
headers = {'Content-Type': 'application/json'}

def log_test(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def test_booking_fix():
    """Test the booking functionality after the fix"""
    print("=== Testing Booking Fix ===")
    
    # Create two test users
    user1_data = {
        "email": "booktest1@dance.com",
        "username": "booktest1",
        "name": "Book Test 1",
        "password": "testpass123"
    }
    
    user2_data = {
        "email": "booktest2@dance.com",
        "username": "booktest2",
        "name": "Book Test 2",
        "password": "testpass123"
    }
    
    # Register user1 (student)
    response = requests.post(f"{BASE_URL}/auth/register", json=user1_data, headers=headers)
    if response.status_code == 200:
        user1_token = response.json()["access_token"]
        log_test("Register Student", True, "Student registered")
    elif response.status_code == 400:
        # Login instead
        response = requests.post(f"{BASE_URL}/auth/login", 
                               json={"email": user1_data["email"], "password": user1_data["password"]}, 
                               headers=headers)
        user1_token = response.json()["access_token"]
        log_test("Login Student", True, "Student logged in")
    
    # Register user2 (teacher)
    response = requests.post(f"{BASE_URL}/auth/register", json=user2_data, headers=headers)
    if response.status_code == 200:
        user2_token = response.json()["access_token"]
        user2_id = response.json()["user"]["id"]
        log_test("Register Teacher", True, "Teacher registered")
    elif response.status_code == 400:
        # Login instead
        response = requests.post(f"{BASE_URL}/auth/login",
                               json={"email": user2_data["email"], "password": user2_data["password"]}, 
                               headers=headers)
        user2_token = response.json()["access_token"]
        user2_id = response.json()["user"]["id"]
        log_test("Login Teacher", True, "Teacher logged in")
    
    # Teacher creates availability slot
    auth_headers_teacher = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {user2_token}'
    }
    
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    slot_data = {
        "date": tomorrow,
        "start_time": "10:00",
        "end_time": "11:00",
        "dance_categories": ["jazz", "contemporary"],
        "price": 65.0
    }
    
    response = requests.post(f"{BASE_URL}/availability-slots", json=slot_data, headers=auth_headers_teacher)
    
    if response.status_code == 200:
        slot_id = response.json()["id"]
        log_test("Create Slot", True, f"Slot created: {slot_id}")
        
        # Student books the slot
        auth_headers_student = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {user1_token}'
        }
        
        booking_data = {"slot_id": slot_id}
        
        response = requests.post(f"{BASE_URL}/bookings", json=booking_data, headers=auth_headers_student)
        
        if response.status_code == 200:
            booking = response.json()
            log_test("Create Booking", True, f"Booking ID: {booking['id']}, Amount: ${booking['amount']}")
            return True
        else:
            log_test("Create Booking", False, f"Status code: {response.status_code}, Response: {response.text}")
            return False
    else:
        log_test("Create Slot", False, f"Status code: {response.status_code}")
        return False

if __name__ == "__main__":
    test_booking_fix()