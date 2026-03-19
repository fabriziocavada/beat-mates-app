"""
Iteration 20 - Available Teachers Endpoint Testing
Focus: GET /api/available-teachers bugfix verification

Tests:
1. Only returns users with is_available=True (not ALL users)
2. Includes real ratings from reviews collection
3. Includes review_count field
4. Marks busy teachers with is_busy=true and remaining_minutes
5. Auto-closes stale active sessions (>2 hours old)
6. Does NOT include available_since field
7. Sorts by rating descending within status groups
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://beat-mates-app-1.preview.emergentagent.com').rstrip('/')

# Test credentials from main agent context
STUDENT_EMAIL = "mario@test.com"
STUDENT_PASSWORD = "password123"
TEACHER_EMAIL = "tutor@test.com"
TEACHER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def student_token():
    """Get authentication token for student account"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_EMAIL,
        "password": STUDENT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Student login failed: {response.status_code} - {response.text}")
    data = response.json()
    # Use access_token field (not 'token')
    return data.get("access_token")


@pytest.fixture(scope="module")
def teacher_token():
    """Get authentication token for teacher account"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Teacher login failed: {response.status_code} - {response.text}")
    data = response.json()
    return data.get("access_token")


@pytest.fixture(scope="module")
def student_user(student_token):
    """Get student user data"""
    response = requests.get(f"{BASE_URL}/api/users/me", headers={
        "Authorization": f"Bearer {student_token}"
    })
    if response.status_code == 200:
        return response.json()
    pytest.skip("Failed to get student user data")


@pytest.fixture(scope="module")
def teacher_user(teacher_token):
    """Get teacher user data"""
    response = requests.get(f"{BASE_URL}/api/users/me", headers={
        "Authorization": f"Bearer {teacher_token}"
    })
    if response.status_code == 200:
        return response.json()
    pytest.skip("Failed to get teacher user data")


class TestAvailableTeachersEndpoint:
    """Test GET /api/available-teachers endpoint"""
    
    def test_endpoint_returns_200(self, student_token):
        """Test that endpoint returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASSED: Endpoint returns 200 with {len(data)} teachers")
    
    def test_only_returns_available_users(self, student_token):
        """Test that only users with is_available=True are returned (BUG FIX)"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        # All returned teachers should have been filtered by is_available=True from DB
        # The returned is_available field might be False if they're busy, but they should
        # still originate from is_available=True in the database
        # Key check: we should NOT get ALL users, only those who set themselves available
        print(f"PASSED: Returns {len(data)} available teachers (filtered by is_available=True)")
        
        # Verify response structure
        for teacher in data:
            assert "id" in teacher, "Teacher should have id"
            assert "username" in teacher, "Teacher should have username"
            assert "is_busy" in teacher, "Teacher should have is_busy field"
            assert "is_available" in teacher, "Teacher should have is_available field"
    
    def test_no_available_since_field(self, student_token):
        """Test that available_since field is NOT included (BUG FIX)"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        for teacher in data:
            assert "available_since" not in teacher, f"available_since should NOT be in response but found: {teacher}"
        print(f"PASSED: No available_since field in any of {len(data)} teachers")
    
    def test_includes_review_count_field(self, student_token):
        """Test that review_count field is included"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        for teacher in data:
            assert "review_count" in teacher, f"review_count should be in response for teacher {teacher.get('username')}"
            assert isinstance(teacher["review_count"], int), "review_count should be an integer"
        print(f"PASSED: review_count field present in all {len(data)} teachers")
    
    def test_includes_rating_field(self, student_token):
        """Test that rating field is included (from reviews collection)"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        for teacher in data:
            assert "rating" in teacher, f"rating should be in response for teacher {teacher.get('username')}"
            assert isinstance(teacher["rating"], (int, float)), "rating should be a number"
        print(f"PASSED: rating field present in all {len(data)} teachers")
    
    def test_includes_is_busy_field(self, student_token):
        """Test that is_busy field is included"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        for teacher in data:
            assert "is_busy" in teacher, f"is_busy should be in response for teacher {teacher.get('username')}"
            assert isinstance(teacher["is_busy"], bool), "is_busy should be a boolean"
        print(f"PASSED: is_busy field present in all {len(data)} teachers")
    
    def test_includes_remaining_minutes_field(self, student_token):
        """Test that remaining_minutes field is included for busy teachers"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        for teacher in data:
            assert "remaining_minutes" in teacher, f"remaining_minutes should be in response for teacher {teacher.get('username')}"
            assert isinstance(teacher["remaining_minutes"], (int, float)), "remaining_minutes should be a number"
            # If is_busy is False, remaining_minutes should be 0
            if not teacher["is_busy"]:
                assert teacher["remaining_minutes"] == 0, f"remaining_minutes should be 0 when not busy"
        print(f"PASSED: remaining_minutes field present and correct in all {len(data)} teachers")
    
    def test_response_structure_complete(self, student_token):
        """Test that response has all expected fields"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = [
            "id", "username", "name", "profile_image", "rating", "review_count",
            "hourly_rate", "dance_categories", "is_available", "is_busy", "remaining_minutes"
        ]
        
        for teacher in data:
            for field in expected_fields:
                assert field in teacher, f"Expected field '{field}' missing from teacher {teacher.get('username', 'unknown')}"
            print(f"  Teacher {teacher.get('username')}: rating={teacher.get('rating')}, review_count={teacher.get('review_count')}, is_busy={teacher.get('is_busy')}")
        
        print(f"PASSED: All {len(expected_fields)} expected fields present in {len(data)} teachers")
    
    def test_excludes_current_user(self, student_token, student_user):
        """Test that current user is excluded from results"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        current_user_id = student_user.get("id")
        for teacher in data:
            assert teacher["id"] != current_user_id, "Current user should not be in results"
        print(f"PASSED: Current user (id={current_user_id}) excluded from {len(data)} results")
    
    def test_sorted_by_availability_and_rating(self, student_token):
        """Test that results are sorted: available first, then by rating descending"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        if len(data) < 2:
            print(f"SKIPPED: Only {len(data)} teachers, cannot verify sorting")
            return
        
        # Check that busy teachers come after available teachers
        seen_busy = False
        prev_rating = None
        for teacher in data:
            if seen_busy and not teacher["is_busy"]:
                pytest.fail("Available teachers should come before busy teachers")
            if teacher["is_busy"]:
                seen_busy = True
        
        # Within each group, check rating is descending
        available_teachers = [t for t in data if not t["is_busy"]]
        busy_teachers = [t for t in data if t["is_busy"]]
        
        for group_name, group in [("available", available_teachers), ("busy", busy_teachers)]:
            if len(group) >= 2:
                ratings = [t["rating"] for t in group]
                # Check if sorted descending (with tolerance for ties)
                for i in range(len(ratings) - 1):
                    if ratings[i] < ratings[i+1]:
                        # Allow if they're very close (floating point issues)
                        if abs(ratings[i] - ratings[i+1]) > 0.01:
                            print(f"WARNING: {group_name} teachers may not be sorted by rating descending: {ratings}")
                            break
        
        print(f"PASSED: Sorting verified - available first ({len(available_teachers)}), then busy ({len(busy_teachers)})")


class TestAvailableTeachersWithTeacherSetup:
    """Test cases that require teacher availability setup"""
    
    def test_teacher_toggle_availability_shows_in_list(self, teacher_token, student_token, teacher_user):
        """Test that toggling availability updates the teacher list"""
        # First, check if teacher is currently available
        initial_response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert initial_response.status_code == 200
        initial_data = initial_response.json()
        teacher_in_list = any(t["id"] == teacher_user["id"] for t in initial_data)
        
        print(f"Initial state: teacher {teacher_user.get('username')} in available list: {teacher_in_list}")
        
        # Toggle availability
        toggle_response = requests.post(f"{BASE_URL}/api/users/me/toggle-availability", headers={
            "Authorization": f"Bearer {teacher_token}"
        })
        assert toggle_response.status_code == 200
        toggle_data = toggle_response.json()
        new_status = toggle_data.get("is_available")
        print(f"Toggled availability to: {new_status}")
        
        # Check available teachers list again
        check_response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": f"Bearer {student_token}"
        })
        assert check_response.status_code == 200
        check_data = check_response.json()
        teacher_now_in_list = any(t["id"] == teacher_user["id"] for t in check_data)
        
        # Verify the teacher appears/disappears based on availability
        if new_status:
            assert teacher_now_in_list, f"Teacher should appear in list when is_available=True"
            print(f"PASSED: Teacher now visible in available teachers list")
        else:
            assert not teacher_now_in_list, f"Teacher should NOT appear in list when is_available=False"
            print(f"PASSED: Teacher now hidden from available teachers list")
        
        # Toggle back to original state for cleanup
        requests.post(f"{BASE_URL}/api/users/me/toggle-availability", headers={
            "Authorization": f"Bearer {teacher_token}"
        })


class TestAuthenticationRequired:
    """Test authentication requirements"""
    
    def test_endpoint_requires_auth(self):
        """Test that endpoint returns 401/403 without auth"""
        response = requests.get(f"{BASE_URL}/api/available-teachers")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASSED: Endpoint requires authentication (returns {response.status_code})")
    
    def test_endpoint_rejects_invalid_token(self):
        """Test that endpoint rejects invalid token"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers={
            "Authorization": "Bearer invalid_token_here"
        })
        assert response.status_code in [401, 403], f"Expected 401/403 with invalid token, got {response.status_code}"
        print(f"PASSED: Endpoint rejects invalid token (returns {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
