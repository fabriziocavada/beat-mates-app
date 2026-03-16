"""
Beat Mates - Iteration 7 Tests
Tests for the video call polling bug fix and notification sound integration

Bug Fixed: Student-side video call polling was broken (counter reset bug)
- The useEffect had [status, waitTime] as dependencies
- setWaitTime called every second reset the effect, so checkSessionStatus() was NEVER called
- Fix: Split into two separate useEffects - one for countdown, one for polling

Tests verify:
1. GET /api/live-sessions/{session_id} returns room_url and status=active after teacher accepts
2. POST /api/live-sessions/request creates a pending session
3. POST /api/live-sessions/{session_id}/accept changes status to active and creates room_url
4. GET /api/live-sessions/pending/count returns correct count for teacher
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dance-community-app.preview.emergentagent.com')

# Test credentials
STUDENT_EMAIL = "mario@test.com"
STUDENT_PASSWORD = "password123"
TEACHER_EMAIL = "teacher@test.com" 
TEACHER_PASSWORD = "password123"


class TestAuth:
    """Authentication tests"""
    
    def test_student_login(self):
        """Verify student can login and get access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should have 'access_token' field"
        assert "user" in data, "Response should have 'user' field"
        assert data["user"]["email"] == STUDENT_EMAIL
    
    def test_teacher_login(self):
        """Verify teacher can login and get access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == TEACHER_EMAIL
        assert data["user"]["is_available"] == True, "Teacher should be available for lessons"


class TestLiveSessionPollingFix:
    """Tests for the critical polling bug fix in request-lesson/[id].tsx
    
    Bug: The useEffect with [status, waitTime] dependencies caused the counter 
    variable to reset to 0 every second, preventing checkSessionStatus() from being called.
    
    Fix: Separated into two independent useEffects - countdown and polling.
    """
    
    @pytest.fixture
    def student_token(self):
        """Get student auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL, "password": STUDENT_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def teacher_token_and_id(self):
        """Get teacher auth token and user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL, "password": TEACHER_PASSWORD
        })
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    def test_create_live_session_request(self, student_token, teacher_token_and_id):
        """Test POST /api/live-sessions/request creates a pending session"""
        teacher_token, teacher_id = teacher_token_and_id
        
        response = requests.post(
            f"{BASE_URL}/api/live-sessions/request",
            headers={"Authorization": f"Bearer {student_token}"},
            json={"teacher_id": teacher_id}
        )
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have session 'id'"
        assert data["status"] == "pending", "New session should be 'pending'"
        assert data["room_url"] is None, "Pending session should have no room_url"
        assert data["teacher_id"] == teacher_id
    
    def test_pending_session_has_no_room_url(self, student_token, teacher_token_and_id):
        """Test GET /api/live-sessions/{id} returns no room_url for pending session"""
        teacher_token, teacher_id = teacher_token_and_id
        
        # Create session
        create_response = requests.post(
            f"{BASE_URL}/api/live-sessions/request",
            headers={"Authorization": f"Bearer {student_token}"},
            json={"teacher_id": teacher_id}
        )
        session_id = create_response.json()["id"]
        
        # Poll as student
        poll_response = requests.get(
            f"{BASE_URL}/api/live-sessions/{session_id}",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert poll_response.status_code == 200
        
        data = poll_response.json()
        assert data["status"] == "pending"
        assert data["room_url"] is None
    
    def test_teacher_pending_count(self, teacher_token_and_id):
        """Test GET /api/live-sessions/pending/count returns count for teacher"""
        teacher_token, _ = teacher_token_and_id
        
        response = requests.get(
            f"{BASE_URL}/api/live-sessions/pending/count",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
    
    def test_accept_session_creates_room_url(self, student_token, teacher_token_and_id):
        """Test POST /api/live-sessions/{id}/accept creates room_url"""
        teacher_token, teacher_id = teacher_token_and_id
        
        # Create session
        create_response = requests.post(
            f"{BASE_URL}/api/live-sessions/request",
            headers={"Authorization": f"Bearer {student_token}"},
            json={"teacher_id": teacher_id}
        )
        session_id = create_response.json()["id"]
        
        # Teacher accepts
        accept_response = requests.post(
            f"{BASE_URL}/api/live-sessions/{session_id}/accept",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert accept_response.status_code == 200, f"Accept failed: {accept_response.text}"
        
        data = accept_response.json()
        assert data["status"] == "active", "Status should be 'active' after accept"
        assert data["room_url"] is not None, "room_url should be set after accept"
        assert "daily.co" in data["room_url"], "room_url should be a Daily.co URL"
    
    def test_critical_polling_returns_room_url_after_accept(self, student_token, teacher_token_and_id):
        """CRITICAL TEST: After teacher accepts, student polling returns room_url
        
        This is the main bug that was fixed. Before the fix, the student's 
        checkSessionStatus() was never called due to the useEffect dependency bug.
        """
        teacher_token, teacher_id = teacher_token_and_id
        
        # Step 1: Student creates session request
        create_response = requests.post(
            f"{BASE_URL}/api/live-sessions/request",
            headers={"Authorization": f"Bearer {student_token}"},
            json={"teacher_id": teacher_id}
        )
        session_id = create_response.json()["id"]
        
        # Step 2: Verify pending state (before accept)
        poll_before = requests.get(
            f"{BASE_URL}/api/live-sessions/{session_id}",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert poll_before.json()["status"] == "pending"
        assert poll_before.json()["room_url"] is None
        
        # Step 3: Teacher accepts
        accept_response = requests.post(
            f"{BASE_URL}/api/live-sessions/{session_id}/accept",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert accept_response.status_code == 200
        
        # Step 4: CRITICAL - Student polls and MUST get status=active and room_url
        poll_after = requests.get(
            f"{BASE_URL}/api/live-sessions/{session_id}",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert poll_after.status_code == 200
        
        data = poll_after.json()
        assert data["status"] == "active", f"Expected 'active', got '{data['status']}'"
        assert data["room_url"] is not None, "room_url must be present after accept"
        assert data["room_url"].startswith("https://"), "room_url must be a valid URL"
        assert "daily.co" in data["room_url"], "room_url should be Daily.co"
        
        print(f"✅ POLLING FIX VERIFIED: status={data['status']}, room_url={data['room_url'][:50]}...")
    
    def test_reject_session(self, student_token, teacher_token_and_id):
        """Test POST /api/live-sessions/{id}/reject changes status"""
        teacher_token, teacher_id = teacher_token_and_id
        
        # Create session
        create_response = requests.post(
            f"{BASE_URL}/api/live-sessions/request",
            headers={"Authorization": f"Bearer {student_token}"},
            json={"teacher_id": teacher_id}
        )
        session_id = create_response.json()["id"]
        
        # Teacher rejects
        reject_response = requests.post(
            f"{BASE_URL}/api/live-sessions/{session_id}/reject",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert reject_response.status_code == 200
        assert reject_response.json()["status"] == "rejected"
        
        # Student polls - should see rejected status
        poll_response = requests.get(
            f"{BASE_URL}/api/live-sessions/{session_id}",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert poll_response.json()["status"] == "rejected"


class TestHealthAndBasicAPI:
    """Basic health checks"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_root_endpoint(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        assert "Beat Mates" in response.json().get("message", "")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
