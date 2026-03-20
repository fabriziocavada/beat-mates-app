"""
Beat Mates API Tests - Iteration 4
Testing bug fixes and features:
- Login API (POST /api/auth/login)
- Feed loads (GET /api/posts)
- Stories load and creation (GET/POST /api/stories)
- Profile picture update (PUT /api/users/me with profile_image)
- Availability slots (POST /api/availability-slots)
- Post creation (POST /api/posts)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://coaching-connect-8.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')

# Test credentials
TEST_EMAIL = "mario@test.com"
TEST_PASSWORD = "password123"


class TestAuthLogin:
    """REGRESSION: Login still works (POST /api/auth/login)"""
    
    def test_login_success(self):
        """Test login with valid credentials returns token and user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response missing access_token"
        assert "user" in data, "Response missing user object"
        assert data["user"]["email"] == TEST_EMAIL
        assert len(data["access_token"]) > 10
        print(f"PASS: Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, "Should return 401 for invalid credentials"
        print("PASS: Invalid credentials correctly rejected")


class TestFeedAndPosts:
    """REGRESSION: Feed loads with posts (GET /api/posts)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_get_posts_feed(self, auth_token):
        """Test feed endpoint returns posts list"""
        response = requests.get(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Feed failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: Feed loaded with {len(data)} posts")
    
    def test_create_post(self, auth_token):
        """FEATURE: Post creation - POST /api/posts with media and caption"""
        test_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "type": "photo",
                "caption": f"TEST_{test_id} - Test post creation",
                "media": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            }
        )
        assert response.status_code == 200, f"Post creation failed: {response.text}"
        
        data = response.json()
        assert data["type"] == "photo"
        assert f"TEST_{test_id}" in data["caption"]
        assert "id" in data
        print(f"PASS: Post created with ID {data['id']}")


class TestStories:
    """REGRESSION: Stories load (GET /api/stories)
       FEATURE: Story creation - POST /api/stories with media URL"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_get_stories(self, auth_token):
        """Test stories endpoint returns grouped stories"""
        response = requests.get(
            f"{BASE_URL}/api/stories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Stories failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: Stories loaded with {len(data)} user story groups")
    
    def test_create_story(self, auth_token):
        """Test story creation with base64 media"""
        response = requests.post(
            f"{BASE_URL}/api/stories",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "media": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "type": "photo"
            }
        )
        assert response.status_code == 200, f"Story creation failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["type"] == "photo"
        assert "media" in data
        print(f"PASS: Story created with ID {data['id']}")


class TestProfilePicture:
    """FEATURE: Profile picture change - upload file then PUT /api/users/me with profile_image"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_update_profile_image(self, auth_token):
        """Test updating profile image via PUT /api/users/me"""
        test_image_url = "/api/uploads/test_profile_iteration4.jpg"
        
        response = requests.put(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"profile_image": test_image_url}
        )
        assert response.status_code == 200, f"Profile update failed: {response.text}"
        
        data = response.json()
        assert data["profile_image"] == test_image_url
        print(f"PASS: Profile image updated to {test_image_url}")
        
        # Verify by fetching user again
        get_response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        user_data = get_response.json()
        assert user_data["profile_image"] == test_image_url
        print("PASS: Profile image persisted correctly")


class TestAvailabilitySlots:
    """REGRESSION: Availability slots (POST /api/availability-slots with date, start_time, end_time, dance_categories, price)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_create_availability_slot(self, auth_token):
        """Test creating availability slot with all required fields"""
        response = requests.post(
            f"{BASE_URL}/api/availability-slots",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "date": "2026-03-20",
                "start_time": "14:00",
                "end_time": "16:00",
                "dance_categories": ["latin", "contemporary"],
                "price": 65.0
            }
        )
        assert response.status_code == 200, f"Slot creation failed: {response.text}"
        
        data = response.json()
        assert data["date"] == "2026-03-20"
        assert data["start_time"] == "14:00"
        assert data["end_time"] == "16:00"
        assert "latin" in data["dance_categories"]
        assert data["price"] == 65.0
        assert data["is_booked"] == False
        print(f"PASS: Availability slot created with ID {data['id']}")
    
    def test_get_availability_slots(self, auth_token):
        """Test fetching user's availability slots"""
        response = requests.get(
            f"{BASE_URL}/api/availability-slots",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get slots failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Retrieved {len(data)} availability slots")


class TestHealthAndMisc:
    """Additional API health and misc tests"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("PASS: Health check passed")
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "Beat Mates" in data["message"]
        print("PASS: API root responds correctly")
    
    def test_dance_categories(self):
        """Test dance categories endpoint (no auth required would be better UX but currently requires auth)"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/dance-categories",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert any(cat["id"] == "latin" for cat in data)
        print(f"PASS: Retrieved {len(data)} dance categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
