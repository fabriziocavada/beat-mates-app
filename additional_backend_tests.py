#!/usr/bin/env python3
"""
Additional Backend API Tests for BEAT MATES
Tests endpoints not covered in main backend_test.py
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://beat-mates-app.preview.emergentagent.com/api"
headers = {'Content-Type': 'application/json'}

# Test users
test_user1 = {
    "email": "testuser1@dance.com",
    "username": "dancer1",
    "name": "Dancer One",
    "password": "securepass123"
}

test_user2 = {
    "email": "testuser2@dance.com", 
    "username": "dancer2",
    "name": "Dancer Two",
    "password": "securepass123"
}

# Global tokens
token1 = None
token2 = None
user1_id = None
user2_id = None
test_post_id = None

def log_test(test_name, success, details=""):
    """Log test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def setup_test_users():
    """Create two test users for interaction testing"""
    print("=== Setting up Test Users ===")
    global token1, token2, user1_id, user2_id
    
    # Try to register user1
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=test_user1, headers=headers)
        if response.status_code == 200:
            data = response.json()
            token1 = data["access_token"]
            user1_id = data["user"]["id"]
            log_test("Register User 1", True, f"Created user: {user1_id}")
        elif response.status_code == 400:
            # User exists, try login
            response = requests.post(f"{BASE_URL}/auth/login", 
                                   json={"email": test_user1["email"], "password": test_user1["password"]}, 
                                   headers=headers)
            if response.status_code == 200:
                data = response.json()
                token1 = data["access_token"]
                user1_id = data["user"]["id"]
                log_test("Login User 1", True, f"Logged in user: {user1_id}")
    except Exception as e:
        log_test("Setup User 1", False, f"Exception: {str(e)}")
        return False

    # Try to register user2
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=test_user2, headers=headers)
        if response.status_code == 200:
            data = response.json()
            token2 = data["access_token"]
            user2_id = data["user"]["id"]
            log_test("Register User 2", True, f"Created user: {user2_id}")
        elif response.status_code == 400:
            # User exists, try login
            response = requests.post(f"{BASE_URL}/auth/login",
                                   json={"email": test_user2["email"], "password": test_user2["password"]}, 
                                   headers=headers)
            if response.status_code == 200:
                data = response.json()
                token2 = data["access_token"]
                user2_id = data["user"]["id"]
                log_test("Login User 2", True, f"Logged in user: {user2_id}")
    except Exception as e:
        log_test("Setup User 2", False, f"Exception: {str(e)}")
        return False

    return token1 and token2

def test_follow_unfollow():
    """Test follow/unfollow functionality"""
    print("=== Testing Follow/Unfollow ===")
    if not token1 or not token2:
        log_test("Follow/Unfollow", False, "Test users not set up properly")
        return False
    
    try:
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token1}'
        }
        
        # User1 follows User2
        response = requests.post(f"{BASE_URL}/users/{user2_id}/follow", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("following") == True:
                log_test("Follow User", True, f"User1 now following User2")
                
                # Test unfollow
                response = requests.post(f"{BASE_URL}/users/{user2_id}/follow", headers=auth_headers)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("following") == False:
                        log_test("Unfollow User", True, f"User1 unfollowed User2")
                        return True
                    else:
                        log_test("Unfollow User", False, "Still following after unfollow")
                        return False
            else:
                log_test("Follow User", False, f"Following status not true: {data}")
                return False
        else:
            log_test("Follow User", False, f"Status code: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Follow/Unfollow", False, f"Exception: {str(e)}")
        return False

def test_post_like():
    """Test post liking functionality"""
    print("=== Testing Post Like/Unlike ===")
    global test_post_id
    
    if not token1 or not token2:
        log_test("Post Like", False, "Test users not set up properly")
        return False
    
    try:
        # User2 creates a post
        auth_headers_2 = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token2}'
        }
        
        post_data = {
            "type": "text",
            "caption": "Test post for like testing! 🕺💃"
        }
        
        response = requests.post(f"{BASE_URL}/posts", json=post_data, headers=auth_headers_2)
        
        if response.status_code == 200:
            data = response.json()
            test_post_id = data["id"]
            log_test("Create Test Post", True, f"Post ID: {test_post_id}")
            
            # User1 likes the post
            auth_headers_1 = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token1}'
            }
            
            response = requests.post(f"{BASE_URL}/posts/{test_post_id}/like", headers=auth_headers_1)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("liked") == True:
                    log_test("Like Post", True, f"Post liked successfully")
                    
                    # Test unlike
                    response = requests.post(f"{BASE_URL}/posts/{test_post_id}/like", headers=auth_headers_1)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("liked") == False:
                            log_test("Unlike Post", True, f"Post unliked successfully")
                            return True
                        else:
                            log_test("Unlike Post", False, "Still liked after unlike")
                            return False
                else:
                    log_test("Like Post", False, f"Like status not true: {data}")
                    return False
            else:
                log_test("Like Post", False, f"Status code: {response.status_code}")
                return False
        else:
            log_test("Create Test Post", False, f"Status code: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Post Like", False, f"Exception: {str(e)}")
        return False

def test_live_session_flow():
    """Test live session request/accept flow"""
    print("=== Testing Live Session Request ===")
    
    if not token1 or not token2:
        log_test("Live Session", False, "Test users not set up properly")
        return False
    
    try:
        # First, make user2 available
        auth_headers_2 = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token2}'
        }
        
        # Set user2 as available and update profile with categories
        update_data = {
            "dance_categories": ["hiphop", "jazz"],
            "is_available": True,
            "hourly_rate": 75.0
        }
        
        response = requests.put(f"{BASE_URL}/users/me", json=update_data, headers=auth_headers_2)
        if response.status_code == 200:
            log_test("Set User2 Available", True, "User2 set to available")
            
            # User1 requests live session with User2
            auth_headers_1 = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token1}'
            }
            
            session_data = {"teacher_id": user2_id}
            
            response = requests.post(f"{BASE_URL}/live-sessions/request", json=session_data, headers=auth_headers_1)
            
            if response.status_code == 200:
                data = response.json()
                session_id = data["id"]
                log_test("Request Live Session", True, f"Session ID: {session_id}, Amount: ${data['amount']}")
                
                # Check pending sessions for user2 (teacher)
                response = requests.get(f"{BASE_URL}/live-sessions/pending", headers=auth_headers_2)
                
                if response.status_code == 200:
                    sessions = response.json()
                    if len(sessions) >= 1:
                        log_test("Get Pending Sessions", True, f"Found {len(sessions)} pending session(s)")
                        return True
                    else:
                        log_test("Get Pending Sessions", False, "No pending sessions found")
                        return False
                else:
                    log_test("Get Pending Sessions", False, f"Status code: {response.status_code}")
                    return False
            else:
                log_test("Request Live Session", False, f"Status code: {response.status_code}, Response: {response.text}")
                return False
        else:
            log_test("Set User2 Available", False, f"Status code: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Live Session", False, f"Exception: {str(e)}")
        return False

def test_booking_flow():
    """Test booking availability slots"""
    print("=== Testing Booking Flow ===")
    
    if not token1 or not token2:
        log_test("Booking Flow", False, "Test users not set up properly")
        return False
    
    try:
        # User2 creates an availability slot
        auth_headers_2 = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token2}'
        }
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        slot_data = {
            "date": tomorrow,
            "start_time": "16:00",
            "end_time": "17:00",
            "dance_categories": ["hiphop", "contemporary"],
            "price": 80.0
        }
        
        response = requests.post(f"{BASE_URL}/availability-slots", json=slot_data, headers=auth_headers_2)
        
        if response.status_code == 200:
            data = response.json()
            slot_id = data["id"]
            log_test("Create Availability Slot", True, f"Slot ID: {slot_id}")
            
            # User1 books the slot
            auth_headers_1 = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token1}'
            }
            
            booking_data = {"slot_id": slot_id}
            
            response = requests.post(f"{BASE_URL}/bookings", json=booking_data, headers=auth_headers_1)
            
            if response.status_code == 200:
                data = response.json()
                booking_id = data["id"]
                log_test("Book Slot", True, f"Booking ID: {booking_id}, Amount: ${data['amount']}")
                
                # Check my bookings
                response = requests.get(f"{BASE_URL}/bookings", headers=auth_headers_1)
                
                if response.status_code == 200:
                    bookings = response.json()
                    if len(bookings) >= 1:
                        log_test("Get My Bookings", True, f"Found {len(bookings)} booking(s)")
                        return True
                    else:
                        log_test("Get My Bookings", False, "No bookings found")
                        return False
                else:
                    log_test("Get My Bookings", False, f"Status code: {response.status_code}")
                    return False
            else:
                log_test("Book Slot", False, f"Status code: {response.status_code}, Response: {response.text}")
                return False
        else:
            log_test("Create Availability Slot", False, f"Status code: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Booking Flow", False, f"Exception: {str(e)}")
        return False

def test_existing_user_login():
    """Test login with existing user mario@test.com"""
    print("=== Testing Existing User Login ===")
    try:
        login_data = {
            "email": "mario@test.com",
            "password": "password123"
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                log_test("Existing User Login", True, f"Mario logged in successfully: {data['user']['name']}")
                
                # Test getting current user
                auth_headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {data["access_token"]}'
                }
                
                response = requests.get(f"{BASE_URL}/users/me", headers=auth_headers)
                if response.status_code == 200:
                    user_data = response.json()
                    log_test("Get Mario Profile", True, f"Profile: {user_data['name']} ({user_data['email']})")
                    return True
                else:
                    log_test("Get Mario Profile", False, f"Status code: {response.status_code}")
                    return False
            else:
                log_test("Existing User Login", False, "Missing token or user in response")
                return False
        else:
            log_test("Existing User Login", False, f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Existing User Login", False, f"Exception: {str(e)}")
        return False

def main():
    """Run additional tests"""
    print("🎭 BEAT MATES Additional API Tests")
    print("=" * 50)
    print(f"Backend URL: {BASE_URL}")
    print("=" * 50)
    
    # Track test results
    test_results = {}
    
    # Setup test users
    if setup_test_users():
        print("✅ Test users set up successfully\n")
        
        # Run interaction tests
        test_results["Follow/Unfollow"] = test_follow_unfollow()
        test_results["Post Like/Unlike"] = test_post_like()
        test_results["Live Session Request"] = test_live_session_flow()
        test_results["Booking Flow"] = test_booking_flow()
    else:
        print("❌ Failed to set up test users\n")
        test_results["User Setup"] = False
    
    # Test existing user
    test_results["Existing User Login"] = test_existing_user_login()
    
    # Summary
    print("=" * 50)
    print("📊 ADDITIONAL TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print("=" * 50)
    print(f"🎯 RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All additional tests passed!")
    else:
        print("⚠️  Some additional tests failed. Check the details above.")
    
    return test_results

if __name__ == "__main__":
    main()