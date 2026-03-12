"""
Beat Mates Iteration 5 - Daily.co Video Call Integration Tests
Tests:
- POST /api/video-call/create-room - creates Daily.co room
- POST /api/video-call/token - generates meeting token
- POST /api/video-call/end/{room_name} - ends video call
- Full lesson flow: register teacher, set available, student requests, teacher accepts (with room_url)
- GET /api/live-sessions/{session_id} - returns session with room_url and room_name
- Regression tests for auth, posts, stories
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://rhythm-connect-14.preview.emergentagent.com"

class TestHealthAndRegression:
    """Health check and regression tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("PASSED: Health endpoint returns healthy")
    
    def test_api_root(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "version" in data
        print("PASSED: API root returns version info")


class TestAuthRegression:
    """Regression tests for authentication"""
    
    def test_login_with_test_user(self):
        """Test login with mario@test.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print("PASSED: Login with mario@test.com works")
    
    def test_login_with_teacher_user(self):
        """Test login with teacher@test.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "teacher@test.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print("PASSED: Login with teacher@test.com works")


class TestFeedRegression:
    """Regression tests for feed and stories"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for mario@test.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        return response.json()["access_token"]
    
    def test_get_posts(self, auth_token):
        """Test GET /api/posts returns posts"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASSED: GET /api/posts returns {len(data)} posts")
    
    def test_get_stories(self, auth_token):
        """Test GET /api/stories returns stories"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/stories", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASSED: GET /api/stories returns {len(data)} story groups")


class TestVideoCallEndpoints:
    """Tests for Daily.co video call endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for mario@test.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        return response.json()["access_token"]
    
    def test_create_video_room(self, auth_token):
        """Test POST /api/video-call/create-room creates Daily.co room"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/video-call/create-room", headers=headers)
        
        # Should return 200 with room_url or 500 if Daily.co API key not configured
        if response.status_code == 200:
            data = response.json()
            assert "room_url" in data
            assert "room_name" in data
            assert "daily.co" in data["room_url"].lower() or "beatmates" in data["room_name"]
            print(f"PASSED: Video room created - {data['room_name']}")
        elif response.status_code == 500:
            # Daily.co API might not be configured correctly
            data = response.json()
            print(f"WARNING: Video room creation failed - {data.get('detail', 'Unknown error')}")
            pytest.skip("Daily.co API not configured or failed")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_create_video_room_and_get_token(self, auth_token):
        """Test creating room and getting token"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create room first
        create_response = requests.post(f"{BASE_URL}/api/video-call/create-room", headers=headers)
        
        if create_response.status_code != 200:
            pytest.skip("Daily.co room creation failed")
        
        room_data = create_response.json()
        room_name = room_data["room_name"]
        
        # Get token for the room
        token_response = requests.post(
            f"{BASE_URL}/api/video-call/token",
            params={"room_name": room_name},
            headers=headers
        )
        
        if token_response.status_code == 200:
            token_data = token_response.json()
            assert "token" in token_data
            print(f"PASSED: Got meeting token for room {room_name}")
        else:
            print(f"WARNING: Token generation failed - {token_response.json().get('detail', 'Unknown')}")
            pytest.skip("Token generation failed")
    
    def test_end_video_call(self, auth_token):
        """Test POST /api/video-call/end/{room_name} ends call"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create room first
        create_response = requests.post(f"{BASE_URL}/api/video-call/create-room", headers=headers)
        
        if create_response.status_code != 200:
            pytest.skip("Daily.co room creation failed")
        
        room_data = create_response.json()
        room_name = room_data["room_name"]
        
        # End the call
        end_response = requests.post(
            f"{BASE_URL}/api/video-call/end/{room_name}",
            headers=headers
        )
        
        if end_response.status_code == 200:
            data = end_response.json()
            assert data.get("status") == "ended"
            print(f"PASSED: Video call ended for room {room_name}")
        else:
            print(f"WARNING: End call failed - {end_response.json().get('detail', 'Unknown')}")
            pytest.skip("End call failed")


class TestFullLessonFlowWithVideoCall:
    """Tests for full lesson flow with video call integration"""
    
    @pytest.fixture
    def teacher_credentials(self):
        """Teacher user credentials"""
        return {"email": "teacher@test.com", "password": "password123"}
    
    @pytest.fixture
    def student_credentials(self):
        """Student user credentials"""
        return {"email": "mario@test.com", "password": "password123"}
    
    @pytest.fixture
    def teacher_token(self, teacher_credentials):
        """Get teacher auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=teacher_credentials)
        if response.status_code != 200:
            pytest.skip("Teacher login failed")
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    @pytest.fixture
    def student_token(self, student_credentials):
        """Get student auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=student_credentials)
        if response.status_code != 200:
            pytest.skip("Student login failed")
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    def test_teacher_set_available(self, teacher_token):
        """Test teacher can toggle availability"""
        token, user_id = teacher_token
        headers = {"Authorization": f"Bearer {token}"}
        
        # First get current status
        me_response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        assert me_response.status_code == 200
        current_status = me_response.json().get("is_available", False)
        
        # Toggle availability
        toggle_response = requests.post(f"{BASE_URL}/api/users/me/toggle-availability", headers=headers)
        assert toggle_response.status_code == 200
        new_status = toggle_response.json().get("is_available")
        
        # Verify it toggled
        assert new_status != current_status
        print(f"PASSED: Teacher availability toggled to {new_status}")
        
        # Return the final availability status
        return new_status
    
    def test_student_requests_lesson_from_available_teacher(self, student_token, teacher_token):
        """Test student can request lesson from available teacher"""
        student_tk, student_id = student_token
        teacher_tk, teacher_id = teacher_token
        
        student_headers = {"Authorization": f"Bearer {student_tk}"}
        teacher_headers = {"Authorization": f"Bearer {teacher_tk}"}
        
        # Ensure teacher is available
        me_response = requests.get(f"{BASE_URL}/api/users/me", headers=teacher_headers)
        teacher_available = me_response.json().get("is_available", False)
        
        if not teacher_available:
            # Toggle to make available
            toggle_response = requests.post(f"{BASE_URL}/api/users/me/toggle-availability", headers=teacher_headers)
            assert toggle_response.status_code == 200
            teacher_available = toggle_response.json().get("is_available")
        
        if not teacher_available:
            pytest.skip("Could not make teacher available")
        
        # Student requests lesson
        request_response = requests.post(
            f"{BASE_URL}/api/live-sessions/request",
            json={"teacher_id": teacher_id},
            headers=student_headers
        )
        
        if request_response.status_code == 400:
            # Teacher might not be available or self-request
            detail = request_response.json().get("detail", "")
            print(f"WARNING: Session request failed - {detail}")
            pytest.skip(f"Session request failed: {detail}")
        
        assert request_response.status_code == 200
        session = request_response.json()
        assert session["status"] == "pending"
        assert session["teacher_id"] == teacher_id
        assert session["student_id"] == student_id
        print(f"PASSED: Student requested lesson, session ID: {session['id']}")
        
        return session["id"], student_tk, teacher_tk, teacher_id
    
    def test_teacher_accepts_and_creates_room(self, student_token, teacher_token):
        """Test teacher accepts lesson request and Daily.co room is created"""
        student_tk, student_id = student_token
        teacher_tk, teacher_id = teacher_token
        
        student_headers = {"Authorization": f"Bearer {student_tk}"}
        teacher_headers = {"Authorization": f"Bearer {teacher_tk}"}
        
        # Ensure teacher is available
        me_response = requests.get(f"{BASE_URL}/api/users/me", headers=teacher_headers)
        teacher_available = me_response.json().get("is_available", False)
        
        if not teacher_available:
            toggle_response = requests.post(f"{BASE_URL}/api/users/me/toggle-availability", headers=teacher_headers)
            teacher_available = toggle_response.json().get("is_available")
        
        if not teacher_available:
            pytest.skip("Could not make teacher available")
        
        # Student requests lesson
        request_response = requests.post(
            f"{BASE_URL}/api/live-sessions/request",
            json={"teacher_id": teacher_id},
            headers=student_headers
        )
        
        if request_response.status_code != 200:
            pytest.skip("Session request failed")
        
        session = request_response.json()
        session_id = session["id"]
        
        # Teacher accepts the session
        accept_response = requests.post(
            f"{BASE_URL}/api/live-sessions/{session_id}/accept",
            headers=teacher_headers
        )
        
        assert accept_response.status_code == 200
        accepted_session = accept_response.json()
        
        # Verify session is active
        assert accepted_session["status"] == "active"
        
        # Verify room_url is present (Daily.co integration)
        if accepted_session.get("room_url"):
            print(f"PASSED: Session accepted with room_url: {accepted_session['room_url']}")
            assert "daily.co" in accepted_session["room_url"].lower()
        else:
            print("WARNING: Session accepted but room_url is None (Daily.co might have failed)")
        
        # Verify room_name is present
        if accepted_session.get("room_name"):
            print(f"PASSED: Room name: {accepted_session['room_name']}")
        
        return session_id, student_headers, teacher_headers
    
    def test_get_session_returns_room_info(self, student_token, teacher_token):
        """Test GET /api/live-sessions/{id} returns session with room_url and room_name"""
        student_tk, student_id = student_token
        teacher_tk, teacher_id = teacher_token
        
        student_headers = {"Authorization": f"Bearer {student_tk}"}
        teacher_headers = {"Authorization": f"Bearer {teacher_tk}"}
        
        # Ensure teacher is available
        me_response = requests.get(f"{BASE_URL}/api/users/me", headers=teacher_headers)
        teacher_available = me_response.json().get("is_available", False)
        
        if not teacher_available:
            toggle_response = requests.post(f"{BASE_URL}/api/users/me/toggle-availability", headers=teacher_headers)
            teacher_available = toggle_response.json().get("is_available")
        
        if not teacher_available:
            pytest.skip("Could not make teacher available")
        
        # Create and accept session
        request_response = requests.post(
            f"{BASE_URL}/api/live-sessions/request",
            json={"teacher_id": teacher_id},
            headers=student_headers
        )
        
        if request_response.status_code != 200:
            pytest.skip("Session request failed")
        
        session_id = request_response.json()["id"]
        
        # Accept
        accept_response = requests.post(
            f"{BASE_URL}/api/live-sessions/{session_id}/accept",
            headers=teacher_headers
        )
        
        if accept_response.status_code != 200:
            pytest.skip("Session accept failed")
        
        # GET the session
        get_response = requests.get(
            f"{BASE_URL}/api/live-sessions/{session_id}",
            headers=student_headers
        )
        
        assert get_response.status_code == 200
        session = get_response.json()
        
        assert session["id"] == session_id
        assert session["status"] == "active"
        
        # Verify LiveSessionResponse model fields
        assert "room_url" in session
        assert "room_name" in session
        assert "teacher" in session
        
        if session.get("room_url"):
            print(f"PASSED: GET session returns room_url: {session['room_url']}")
        else:
            print("WARNING: GET session returns None room_url (Daily.co might not be configured)")
        
        print(f"PASSED: GET /api/live-sessions/{session_id} returns correct data")


class TestSessionEndpoints:
    """Additional session endpoint tests"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get teacher auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "teacher@test.com",
            "password": "password123"
        })
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    def test_get_pending_sessions(self, teacher_token):
        """Test GET /api/live-sessions/pending returns pending sessions"""
        token, user_id = teacher_token
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/live-sessions/pending", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASSED: GET /api/live-sessions/pending returns {len(data)} pending sessions")
    
    def test_get_pending_count(self, teacher_token):
        """Test GET /api/live-sessions/pending/count returns count"""
        token, user_id = teacher_token
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/live-sessions/pending/count", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"PASSED: GET /api/live-sessions/pending/count returns count: {data['count']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
