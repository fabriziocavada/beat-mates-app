#!/usr/bin/env python3
"""
Backend API Testing for BEAT MATES Dance Social App
Tests all main endpoints as specified in the review request
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://dance-feed-test.preview.emergentagent.com/api"
headers = {'Content-Type': 'application/json'}
auth_token = None

# Test data
test_user_data = {
    "email": "dancer@example.com",
    "username": "testdancer123",
    "name": "Test Dancer",
    "password": "securepass123"
}

login_data = {
    "email": "dancer@example.com", 
    "password": "securepass123"
}

def log_test(test_name, success, details=""):
    """Log test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def test_health_check():
    """Test basic health endpoint"""
    print("=== Testing Health Check ===")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            log_test("Health Check", True, f"Status: {response.json()}")
            return True
        else:
            log_test("Health Check", False, f"Status code: {response.status_code}")
            return False
    except Exception as e:
        log_test("Health Check", False, f"Exception: {str(e)}")
        return False

def test_register():
    """Test user registration"""
    print("=== Testing User Registration ===")
    try:
        response = requests.post(f"{BASE_URL}/auth/register", 
                               json=test_user_data, 
                               headers=headers, 
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                global auth_token
                auth_token = data["access_token"]
                log_test("User Registration", True, 
                        f"Token received, User ID: {data['user']['id']}")
                return True
            else:
                log_test("User Registration", False, "Missing token or user in response")
                return False
        elif response.status_code == 400:
            # User might already exist, try to login instead
            print("   User might already exist, will try login...")
            return test_login()
        else:
            log_test("User Registration", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("User Registration", False, f"Exception: {str(e)}")
        return False

def test_login():
    """Test user login"""
    print("=== Testing User Login ===")
    try:
        response = requests.post(f"{BASE_URL}/auth/login", 
                               json=login_data, 
                               headers=headers, 
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                global auth_token
                auth_token = data["access_token"]
                log_test("User Login", True, 
                        f"Token received, User ID: {data['user']['id']}")
                return True
            else:
                log_test("User Login", False, "Missing token or user in response")
                return False
        else:
            log_test("User Login", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("User Login", False, f"Exception: {str(e)}")
        return False

def test_get_current_user():
    """Test getting current user info with auth token"""
    print("=== Testing Get Current User ===")
    if not auth_token:
        log_test("Get Current User", False, "No auth token available")
        return False
    
    try:
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }
        
        response = requests.get(f"{BASE_URL}/users/me", 
                              headers=auth_headers, 
                              timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "id" in data and "email" in data:
                log_test("Get Current User", True, 
                        f"User: {data['name']} ({data['email']})")
                return True
            else:
                log_test("Get Current User", False, "Missing user fields in response")
                return False
        else:
            log_test("Get Current User", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Get Current User", False, f"Exception: {str(e)}")
        return False

def test_dance_categories():
    """Test getting dance categories (expecting 10 categories)"""
    print("=== Testing Dance Categories ===")
    try:
        response = requests.get(f"{BASE_URL}/dance-categories", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) == 10:
                log_test("Dance Categories", True, 
                        f"Retrieved {len(data)} categories as expected")
                return True
            else:
                log_test("Dance Categories", False, 
                        f"Expected 10 categories, got {len(data) if isinstance(data, list) else 'non-list'}")
                return False
        else:
            log_test("Dance Categories", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Dance Categories", False, f"Exception: {str(e)}")
        return False

def test_update_user_profile():
    """Test updating user profile with dance categories and availability"""
    print("=== Testing Update User Profile ===")
    if not auth_token:
        log_test("Update User Profile", False, "No auth token available")
        return False
    
    try:
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }
        
        update_data = {
            "dance_categories": ["hiphop", "jazz", "contemporary"],
            "is_available": True,
            "bio": "Professional dance instructor"
        }
        
        response = requests.put(f"{BASE_URL}/users/me", 
                              json=update_data,
                              headers=auth_headers, 
                              timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("dance_categories") == update_data["dance_categories"] and \
               data.get("is_available") == update_data["is_available"]:
                log_test("Update User Profile", True, 
                        f"Updated profile with {len(update_data['dance_categories'])} dance categories")
                return True
            else:
                log_test("Update User Profile", False, "Profile not updated correctly")
                return False
        else:
            log_test("Update User Profile", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Update User Profile", False, f"Exception: {str(e)}")
        return False

def test_toggle_availability():
    """Test toggling teacher availability"""
    print("=== Testing Toggle Availability ===")
    if not auth_token:
        log_test("Toggle Availability", False, "No auth token available")
        return False
    
    try:
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }
        
        response = requests.post(f"{BASE_URL}/users/me/toggle-availability", 
                               headers=auth_headers, 
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "is_available" in data:
                log_test("Toggle Availability", True, 
                        f"Availability toggled to: {data['is_available']}")
                return True
            else:
                log_test("Toggle Availability", False, "Missing is_available in response")
                return False
        else:
            log_test("Toggle Availability", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Toggle Availability", False, f"Exception: {str(e)}")
        return False

def test_create_post():
    """Test creating a new post"""
    print("=== Testing Create Post ===")
    if not auth_token:
        log_test("Create Post", False, "No auth token available")
        return False
    
    try:
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }
        
        post_data = {
            "type": "text",
            "caption": "Test post from API testing - sharing my latest dance moves! 💃"
        }
        
        response = requests.post(f"{BASE_URL}/posts", 
                               json=post_data,
                               headers=auth_headers, 
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "id" in data and data.get("type") == "text":
                log_test("Create Post", True, 
                        f"Post created with ID: {data['id']}")
                return True
            else:
                log_test("Create Post", False, "Post not created correctly")
                return False
        else:
            log_test("Create Post", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Create Post", False, f"Exception: {str(e)}")
        return False

def test_get_feed_posts():
    """Test getting feed posts"""
    print("=== Testing Get Feed Posts ===")
    if not auth_token:
        log_test("Get Feed Posts", False, "No auth token available")
        return False
    
    try:
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }
        
        response = requests.get(f"{BASE_URL}/posts", 
                              headers=auth_headers, 
                              timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("Get Feed Posts", True, 
                        f"Retrieved {len(data)} posts from feed")
                return True
            else:
                log_test("Get Feed Posts", False, "Response is not a list")
                return False
        else:
            log_test("Get Feed Posts", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Get Feed Posts", False, f"Exception: {str(e)}")
        return False

def test_get_available_teachers():
    """Test getting list of available teachers"""
    print("=== Testing Get Available Teachers ===")
    if not auth_token:
        log_test("Get Available Teachers", False, "No auth token available")
        return False
    
    try:
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }
        
        response = requests.get(f"{BASE_URL}/available-teachers", 
                              headers=auth_headers, 
                              timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("Get Available Teachers", True, 
                        f"Retrieved {len(data)} available teachers")
                return True
            else:
                log_test("Get Available Teachers", False, "Response is not a list")
                return False
        else:
            log_test("Get Available Teachers", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Get Available Teachers", False, f"Exception: {str(e)}")
        return False

def test_create_availability_slot():
    """Test creating an availability slot"""
    print("=== Testing Create Availability Slot ===")
    if not auth_token:
        log_test("Create Availability Slot", False, "No auth token available")
        return False
    
    try:
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }
        
        # Create slot for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        slot_data = {
            "date": tomorrow,
            "start_time": "14:00",
            "end_time": "15:00",
            "dance_categories": ["hiphop", "jazz"],
            "price": 75.0
        }
        
        response = requests.post(f"{BASE_URL}/availability-slots", 
                               json=slot_data,
                               headers=auth_headers, 
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "id" in data and data.get("date") == tomorrow:
                log_test("Create Availability Slot", True, 
                        f"Slot created for {tomorrow} from {slot_data['start_time']} to {slot_data['end_time']}")
                return True
            else:
                log_test("Create Availability Slot", False, "Slot not created correctly")
                return False
        else:
            log_test("Create Availability Slot", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Create Availability Slot", False, f"Exception: {str(e)}")
        return False

def test_get_my_availability_slots():
    """Test getting my availability slots"""
    print("=== Testing Get My Availability Slots ===")
    if not auth_token:
        log_test("Get My Availability Slots", False, "No auth token available")
        return False
    
    try:
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }
        
        response = requests.get(f"{BASE_URL}/availability-slots", 
                              headers=auth_headers, 
                              timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("Get My Availability Slots", True, 
                        f"Retrieved {len(data)} availability slots")
                return True
            else:
                log_test("Get My Availability Slots", False, "Response is not a list")
                return False
        else:
            log_test("Get My Availability Slots", False, 
                    f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Get My Availability Slots", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🎭 BEAT MATES API Testing Suite")
    print("=" * 50)
    print(f"Backend URL: {BASE_URL}")
    print("=" * 50)
    
    # Track test results
    test_results = {}
    
    # Run all tests in sequence
    test_results["Health Check"] = test_health_check()
    test_results["User Registration"] = test_register()
    test_results["User Login"] = test_login() if not auth_token else True
    test_results["Get Current User"] = test_get_current_user()
    test_results["Dance Categories"] = test_dance_categories()
    test_results["Update User Profile"] = test_update_user_profile()
    test_results["Toggle Availability"] = test_toggle_availability()
    test_results["Create Post"] = test_create_post()
    test_results["Get Feed Posts"] = test_get_feed_posts()
    test_results["Get Available Teachers"] = test_get_available_teachers()
    test_results["Create Availability Slot"] = test_create_availability_slot()
    test_results["Get My Availability Slots"] = test_get_my_availability_slots()
    
    # Summary
    print("=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print("=" * 50)
    print(f"🎯 RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! API is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the details above.")
    
    return test_results

if __name__ == "__main__":
    main()