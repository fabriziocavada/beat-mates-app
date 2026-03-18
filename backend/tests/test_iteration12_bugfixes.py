"""
Iteration 12 Backend Tests
Testing fixed bugs from user report:
1. GET /api/posts/{post_id} - returns single post with user info, is_liked, likes_count, recent_likers
2. PUT /api/users/me - accepts username field and rejects duplicates with 400 error
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://beat-mates-coaching.preview.emergentagent.com')

class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Test API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_login_mario(self):
        """Test login with mario student account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "mario@test.com"
    
    def test_login_tutor(self):
        """Test login with tutor account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tutor@test.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "tutor@test.com"


class TestGetSinglePost:
    """Test GET /api/posts/{post_id} endpoint - fixed bug #1"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for mario"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def get_first_post_id(self, auth_token):
        """Get an existing post ID from the feed"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        assert response.status_code == 200
        posts = response.json()
        if len(posts) == 0:
            pytest.skip("No posts available for testing")
        return posts[0]["id"]
    
    def test_get_single_post_returns_200(self, auth_token, get_first_post_id):
        """Test that GET /api/posts/{id} returns 200 for existing post"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/{get_first_post_id}", headers=headers)
        assert response.status_code == 200
    
    def test_get_single_post_has_required_fields(self, auth_token, get_first_post_id):
        """Test that GET /api/posts/{id} returns all required fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/{get_first_post_id}", headers=headers)
        data = response.json()
        
        # Check all required fields exist
        assert "id" in data
        assert "user_id" in data
        assert "user" in data
        assert "type" in data
        assert "likes_count" in data
        assert "comments_count" in data
        assert "is_liked" in data
        assert "recent_likers" in data
        assert "created_at" in data
    
    def test_get_single_post_user_info(self, auth_token, get_first_post_id):
        """Test that user object has required fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/{get_first_post_id}", headers=headers)
        data = response.json()
        
        user = data.get("user")
        assert user is not None
        assert "id" in user
        assert "username" in user
        assert "name" in user
        # profile_image can be null
        assert "profile_image" in user
    
    def test_get_single_post_recent_likers_array(self, auth_token, get_first_post_id):
        """Test that recent_likers is an array"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/{get_first_post_id}", headers=headers)
        data = response.json()
        
        recent_likers = data.get("recent_likers")
        assert isinstance(recent_likers, list)
        
        # If there are likers, verify their structure
        if len(recent_likers) > 0:
            liker = recent_likers[0]
            assert "id" in liker
            assert "username" in liker
    
    def test_get_single_post_is_liked_boolean(self, auth_token, get_first_post_id):
        """Test that is_liked is a boolean"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/{get_first_post_id}", headers=headers)
        data = response.json()
        
        is_liked = data.get("is_liked")
        assert isinstance(is_liked, bool)
    
    def test_get_nonexistent_post_returns_404(self, auth_token):
        """Test that GET /api/posts/{id} returns 404 for non-existent post"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/nonexistent-post-id-12345", headers=headers)
        assert response.status_code == 404


class TestUserMeUsernameUpdate:
    """Test PUT /api/users/me username field - fixed bug #2"""
    
    @pytest.fixture
    def mario_token(self):
        """Get auth token for mario"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def tutor_token(self):
        """Get auth token for tutor"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tutor@test.com",
            "password": "password123"
        })
        return response.json()["access_token"]
    
    def test_update_username_success(self, mario_token):
        """Test that PUT /api/users/me accepts username field"""
        headers = {"Authorization": f"Bearer {mario_token}"}
        # Use existing username to avoid changing it
        response = requests.put(f"{BASE_URL}/api/users/me", headers=headers, json={
            "username": "mario_dancer"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "mario_dancer"
    
    def test_update_duplicate_username_rejected(self, tutor_token, mario_token):
        """Test that PUT /api/users/me rejects duplicate username with 400 error"""
        headers = {"Authorization": f"Bearer {tutor_token}"}
        # Try to set tutor's username to mario's username
        response = requests.put(f"{BASE_URL}/api/users/me", headers=headers, json={
            "username": "mario_dancer"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "already taken" in data["detail"].lower() or "Username already taken" in data["detail"]
    
    def test_update_other_fields_still_works(self, mario_token):
        """Test that PUT /api/users/me still works for other fields"""
        headers = {"Authorization": f"Bearer {mario_token}"}
        test_bio = f"TEST_Bio updated at {int(time.time()) % 1000000}"
        response = requests.put(f"{BASE_URL}/api/users/me", headers=headers, json={
            "bio": test_bio
        })
        assert response.status_code == 200
        data = response.json()
        assert data["bio"] == test_bio


class TestPostsEndpoint:
    """Test GET /api/posts list endpoint still works"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for mario"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        return response.json()["access_token"]
    
    def test_get_posts_list(self, auth_token):
        """Test GET /api/posts returns list of posts"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_posts_list_has_recent_likers(self, auth_token):
        """Test that posts in list also have recent_likers field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        data = response.json()
        
        if len(data) > 0:
            post = data[0]
            assert "recent_likers" in post
            assert isinstance(post["recent_likers"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
