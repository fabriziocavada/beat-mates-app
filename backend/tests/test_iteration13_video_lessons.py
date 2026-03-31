"""
Iteration 13 - Video Lessons CRUD API Tests
Testing video lessons endpoints as requested:
1. GET /api/video-lessons returns empty array (no 500 error)
2. GET /api/users/{user_id}/video-lessons returns empty array for user
3. PUT /api/video-lessons/{id} returns 404 for non-existent lesson
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lesson-marketplace-5.preview.emergentagent.com").rstrip('/')

# Test credentials
TEACHER_EMAIL = "tutor@test.com"
TEACHER_PASSWORD = "password123"
STUDENT_EMAIL = "mario@test.com" 
STUDENT_PASSWORD = "password123"


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")


class TestAuthentication:
    """Authentication flow tests"""
    
    def test_login_teacher(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ Teacher login successful, user_id: {data['user']['id']}")
        return data["access_token"], data["user"]["id"]
    
    def test_login_student(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ Student login successful, user_id: {data['user']['id']}")
        return data["access_token"], data["user"]["id"]


class TestVideoLessonsAPI:
    """Video Lessons CRUD API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Login failed - skipping video lessons tests")
        data = response.json()
        self.token = data["access_token"]
        self.user_id = data["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_video_lessons_returns_array(self):
        """Test 1: GET /api/video-lessons returns empty array (no 500 error)"""
        response = requests.get(
            f"{BASE_URL}/api/video-lessons",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ GET /api/video-lessons returned array with {len(data)} items")
    
    def test_get_user_video_lessons_returns_array(self):
        """Test 2: GET /api/users/{user_id}/video-lessons returns empty array for user"""
        response = requests.get(
            f"{BASE_URL}/api/users/{self.user_id}/video-lessons",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ GET /api/users/{self.user_id}/video-lessons returned array with {len(data)} items")
    
    def test_get_nonexistent_user_video_lessons(self):
        """Test that GET video-lessons for a non-existent user ID returns empty array"""
        fake_user_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/users/{fake_user_id}/video-lessons",
            headers=self.headers
        )
        # Should still return 200 with empty array (not 404)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) == 0, f"Expected empty array for non-existent user, got {len(data)} items"
        print(f"✓ GET /api/users/{fake_user_id}/video-lessons returned empty array")
    
    def test_update_nonexistent_video_lesson_returns_404(self):
        """Test 3: PUT /api/video-lessons/{id} returns 404 for non-existent lesson"""
        fake_lesson_id = str(uuid.uuid4())
        response = requests.put(
            f"{BASE_URL}/api/video-lessons/{fake_lesson_id}",
            json={"title": "Updated Title", "price": 10.0},
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Lesson not found"
        print(f"✓ PUT /api/video-lessons/{fake_lesson_id} returned 404 'Lesson not found'")
    
    def test_delete_nonexistent_video_lesson_returns_404(self):
        """Test that DELETE /api/video-lessons/{id} returns 404 for non-existent lesson"""
        fake_lesson_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/video-lessons/{fake_lesson_id}",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Lesson not found"
        print(f"✓ DELETE /api/video-lessons/{fake_lesson_id} returned 404 'Lesson not found'")


class TestVideoLessonResponseFormat:
    """Test response format of video lessons endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Login failed")
        data = response.json()
        self.token = data["access_token"]
        self.user_id = data["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_video_lessons_list_structure(self):
        """Verify the structure of video lessons list response"""
        response = requests.get(
            f"{BASE_URL}/api/video-lessons",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # If there are lessons, verify structure
        if len(data) > 0:
            lesson = data[0]
            expected_fields = ["id", "user_id", "title", "description", "price", "currency", 
                            "duration_minutes", "video_url", "thumbnail_url", "created_at"]
            for field in expected_fields:
                assert field in lesson, f"Missing field: {field}"
            print(f"✓ Video lesson has all required fields: {list(lesson.keys())}")
        else:
            print("✓ Video lessons list is empty (expected for new users)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
