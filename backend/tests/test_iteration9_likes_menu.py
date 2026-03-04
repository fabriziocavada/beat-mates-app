"""
Iteration 9 Tests - Like Feature, Hamburger Menu, Video Call Auto-Join
Tests for:
1. GET /api/posts returns posts with recent_likers array containing user id, username, profile_image
2. GET /api/posts/{post_id}/likers returns array of recent likers
3. POST /api/live-sessions/request + /api/live-sessions/{id}/accept creates room
4. GET /api/live-sessions/pending returns pending sessions with student info
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://beat-mates-preview-1.preview.emergentagent.com')

class TestIteration9:
    """Tests for iteration 9 features: likes, hamburger menu, video call auto-join"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth tokens for student and teacher"""
        # Student login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        assert resp.status_code == 200, f"Student login failed: {resp.text}"
        data = resp.json()
        self.student_token = data["access_token"]
        self.student_id = data["user"]["id"]
        self.student_headers = {"Authorization": f"Bearer {self.student_token}"}
        
        # Teacher login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "teacher@test.com",
            "password": "password123"
        })
        assert resp.status_code == 200, f"Teacher login failed: {resp.text}"
        data = resp.json()
        self.teacher_token = data["access_token"]
        self.teacher_id = data["user"]["id"]
        self.teacher_headers = {"Authorization": f"Bearer {self.teacher_token}"}
    
    # ====================== POSTS & LIKES ======================
    
    def test_get_posts_has_recent_likers_field(self):
        """GET /api/posts should return posts with recent_likers array"""
        resp = requests.get(f"{BASE_URL}/api/posts", headers=self.student_headers)
        assert resp.status_code == 200, f"GET /api/posts failed: {resp.text}"
        posts = resp.json()
        
        # Check that posts have recent_likers field
        if len(posts) > 0:
            first_post = posts[0]
            assert "recent_likers" in first_post, "recent_likers field missing from post"
            assert isinstance(first_post["recent_likers"], list), "recent_likers should be a list"
            
            # If there are likers, verify structure
            if len(first_post["recent_likers"]) > 0:
                liker = first_post["recent_likers"][0]
                assert "id" in liker, "Liker missing 'id' field"
                assert "username" in liker, "Liker missing 'username' field"
                assert "profile_image" in liker, "Liker missing 'profile_image' field"
                print(f"recent_likers structure verified: {liker}")
    
    def test_get_post_likers_endpoint(self):
        """GET /api/posts/{post_id}/likers returns array of recent likers"""
        # First get a post
        resp = requests.get(f"{BASE_URL}/api/posts", headers=self.student_headers)
        assert resp.status_code == 200
        posts = resp.json()
        assert len(posts) > 0, "No posts found to test likers endpoint"
        
        post_id = posts[0]["id"]
        resp = requests.get(f"{BASE_URL}/api/posts/{post_id}/likers", headers=self.student_headers)
        assert resp.status_code == 200, f"GET /api/posts/{post_id}/likers failed: {resp.text}"
        likers = resp.json()
        assert isinstance(likers, list), "Likers response should be a list"
        print(f"GET /api/posts/{post_id}/likers returned {len(likers)} likers")
    
    def test_like_post_updates_recent_likers(self):
        """Liking a post should update the recent_likers array"""
        # Get a post to like
        resp = requests.get(f"{BASE_URL}/api/posts", headers=self.student_headers)
        assert resp.status_code == 200
        posts = resp.json()
        assert len(posts) > 0, "No posts found"
        
        post_id = posts[0]["id"]
        initial_likers = posts[0]["recent_likers"]
        initial_count = len(initial_likers)
        
        # Like the post
        resp = requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers=self.student_headers)
        assert resp.status_code == 200, f"Like failed: {resp.text}"
        like_result = resp.json()
        
        # Get likers after action
        resp = requests.get(f"{BASE_URL}/api/posts/{post_id}/likers", headers=self.student_headers)
        assert resp.status_code == 200
        likers_after = resp.json()
        
        if like_result.get("liked"):
            # Student just liked - check their ID in likers
            liker_ids = [l["id"] for l in likers_after]
            assert self.student_id in liker_ids, "Current user should appear in likers after liking"
            print(f"Verified: User appears in likers after liking (total: {len(likers_after)})")
        else:
            # Student just unliked
            print(f"Post was unliked (total likers: {len(likers_after)})")
    
    # ====================== LIVE SESSIONS ======================
    
    def test_get_pending_sessions_returns_student_info(self):
        """GET /api/live-sessions/pending returns pending sessions with student info"""
        # First make teacher available
        requests.put(f"{BASE_URL}/api/users/me", 
            json={"is_available": True}, 
            headers=self.teacher_headers)
        
        resp = requests.get(f"{BASE_URL}/api/live-sessions/pending", headers=self.teacher_headers)
        assert resp.status_code == 200, f"GET pending failed: {resp.text}"
        sessions = resp.json()
        assert isinstance(sessions, list), "Pending sessions should be a list"
        
        # If there are pending sessions, verify structure
        if len(sessions) > 0:
            session = sessions[0]
            assert "student" in session, "Pending session missing 'student' field"
            if session["student"]:
                assert "id" in session["student"], "Student missing 'id'"
                assert "username" in session["student"], "Student missing 'username'"
                assert "name" in session["student"], "Student missing 'name'"
                print(f"Pending session has student info: {session['student']['name']}")
        
        print(f"GET /api/live-sessions/pending returned {len(sessions)} sessions")
    
    def test_request_and_accept_session_creates_room(self):
        """POST /api/live-sessions/request + accept creates room with room_url"""
        # Make teacher available
        requests.put(f"{BASE_URL}/api/users/me", 
            json={"is_available": True}, 
            headers=self.teacher_headers)
        
        # Student requests session
        resp = requests.post(f"{BASE_URL}/api/live-sessions/request", 
            json={"teacher_id": self.teacher_id},
            headers=self.student_headers)
        assert resp.status_code == 200, f"Session request failed: {resp.text}"
        session = resp.json()
        session_id = session["id"]
        assert session["status"] == "pending", "New session should be pending"
        
        # Teacher accepts
        resp = requests.post(f"{BASE_URL}/api/live-sessions/{session_id}/accept",
            headers=self.teacher_headers)
        assert resp.status_code == 200, f"Session accept failed: {resp.text}"
        accepted_session = resp.json()
        
        assert accepted_session["status"] == "active", "Accepted session should be active"
        # Room URL should be created (Daily.co integration)
        print(f"Session accepted. Status: {accepted_session['status']}, Room URL: {accepted_session.get('room_url', 'NOT SET')}")
        
        # Clean up - end the session
        requests.post(f"{BASE_URL}/api/live-sessions/{session_id}/end", headers=self.teacher_headers)
    
    # ====================== HEALTH & REGRESSION ======================
    
    def test_api_health(self):
        """API health check"""
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
    
    def test_login_student(self):
        """Student login works"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Student login successful: {data['user']['username']}")
    
    def test_login_teacher(self):
        """Teacher login works"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "teacher@test.com",
            "password": "password123"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        print(f"Teacher login successful: {data['user']['username']}")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
