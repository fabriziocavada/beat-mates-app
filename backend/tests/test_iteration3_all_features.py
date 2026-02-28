"""
Beat Mates API Tests - Iteration 3
Comprehensive testing of all requested API endpoints:
- Auth: register, login
- Users: get/update profile, toggle availability
- Posts: CRUD, like, comments
- Stories: get grouped by user
- Dance categories
- Available teachers
- Live sessions: request, pending, count
- File upload and media streaming
- User specific posts
"""
import pytest
import requests
import os
import base64
from datetime import datetime
import uuid

# Get BASE_URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials from seed data
TEST_EMAIL = "mario@test.com"
TEST_PASSWORD = "password123"
TEST_USERNAME = "mario_dancer"

# Global state for cross-test data
created_test_data = {}


@pytest.fixture(scope="module")
def auth_session():
    """Module-scoped auth session for all tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login with existing test user
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    
    data = response.json()
    session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    session.user = data["user"]
    session.token = data["access_token"]
    return session


# ==================== AUTH TESTS ====================

class TestAuthRegister:
    """Test POST /api/auth/register - new user registration"""
    
    def test_register_new_user(self):
        """Register a new unique user and verify token+user returned"""
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"TEST_{unique_id}@test.com"
        test_username = f"TEST_user_{unique_id}"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "username": test_username,
            "name": f"Test User {unique_id}",
            "password": "testpass123"
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == test_email
        assert data["user"]["username"] == test_username
        assert "id" in data["user"]
        
        # Store for potential cleanup
        created_test_data["registered_user_id"] = data["user"]["id"]
        print(f"✓ Registered new user: {test_email}")
    
    def test_register_duplicate_email_fails(self):
        """Verify duplicate email returns 400"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,  # Already exists
            "username": "duplicate_test",
            "name": "Duplicate Test",
            "password": "testpass123"
        })
        
        assert response.status_code == 400
        assert "already" in response.json().get("detail", "").lower()
        print("✓ Duplicate email correctly rejected")


class TestAuthLogin:
    """Test POST /api/auth/login - user authentication"""
    
    def test_login_with_email(self):
        """Login with mario@test.com and password123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Verify invalid credentials return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")


# ==================== USER PROFILE TESTS ====================

class TestUserProfile:
    """Test GET/PUT /api/users/me - current user profile"""
    
    def test_get_current_user(self, auth_session):
        """GET /api/users/me - get current user profile (with auth token)"""
        response = auth_session.get(f"{BASE_URL}/api/users/me")
        
        assert response.status_code == 200, f"Failed to get user: {response.text}"
        user = response.json()
        
        # Verify user structure
        assert "id" in user
        assert "email" in user
        assert "username" in user
        assert "name" in user
        assert "bio" in user
        assert "dance_categories" in user
        assert "is_available" in user
        assert "followers_count" in user
        assert "following_count" in user
        assert "posts_count" in user
        
        print(f"✓ GET /api/users/me returned: {user['username']}")
    
    def test_update_user_profile(self, auth_session):
        """PUT /api/users/me - update user profile"""
        timestamp = datetime.now().strftime("%H%M%S")
        new_bio = f"TEST_Bio updated at {timestamp}"
        
        response = auth_session.put(f"{BASE_URL}/api/users/me", json={
            "bio": new_bio
        })
        
        assert response.status_code == 200
        updated_user = response.json()
        assert updated_user["bio"] == new_bio
        
        # Verify persistence with GET
        get_response = auth_session.get(f"{BASE_URL}/api/users/me")
        assert get_response.json()["bio"] == new_bio
        print(f"✓ Profile updated with bio: {new_bio}")


class TestToggleAvailability:
    """Test POST /api/users/me/toggle-availability"""
    
    def test_toggle_availability(self, auth_session):
        """Toggle user availability status"""
        # Get initial state
        initial_response = auth_session.get(f"{BASE_URL}/api/users/me")
        initial_state = initial_response.json()["is_available"]
        
        # Toggle
        toggle_response = auth_session.post(f"{BASE_URL}/api/users/me/toggle-availability")
        assert toggle_response.status_code == 200
        new_state = toggle_response.json()["is_available"]
        
        # Verify toggled
        assert new_state != initial_state
        
        # Verify persistence
        verify_response = auth_session.get(f"{BASE_URL}/api/users/me")
        assert verify_response.json()["is_available"] == new_state
        
        # Toggle back to original state
        auth_session.post(f"{BASE_URL}/api/users/me/toggle-availability")
        print(f"✓ Availability toggled from {initial_state} to {new_state} and back")


# ==================== POSTS TESTS ====================

class TestPostsFeed:
    """Test GET /api/posts - feed endpoint"""
    
    def test_get_posts_feed(self, auth_session):
        """GET /api/posts - should return posts (including seeded 4 posts)"""
        response = auth_session.get(f"{BASE_URL}/api/posts")
        
        assert response.status_code == 200
        posts = response.json()
        
        assert isinstance(posts, list)
        print(f"✓ GET /api/posts returned {len(posts)} posts")
        
        # Verify post structure
        if len(posts) > 0:
            post = posts[0]
            assert "id" in post
            assert "user_id" in post
            assert "type" in post
            assert "user" in post
            assert "likes_count" in post
            assert "comments_count" in post
            assert "is_liked" in post
            print(f"✓ Post structure verified: {list(post.keys())}")
        
        # Count video and photo posts
        video_posts = [p for p in posts if p.get("type") == "video"]
        photo_posts = [p for p in posts if p.get("type") == "photo"]
        print(f"✓ Found {len(video_posts)} video posts and {len(photo_posts)} photo posts")


class TestCreatePost:
    """Test POST /api/posts - create new post"""
    
    def test_create_text_post(self, auth_session):
        """Create a text-only post"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        caption = f"TEST_Text post at {timestamp}"
        
        response = auth_session.post(f"{BASE_URL}/api/posts", json={
            "type": "text",
            "caption": caption
        })
        
        assert response.status_code == 200, f"Create post failed: {response.text}"
        post = response.json()
        
        assert post["type"] == "text"
        assert post["caption"] == caption
        assert "id" in post
        
        created_test_data["text_post_id"] = post["id"]
        print(f"✓ Created text post with id: {post['id']}")
        
        # Verify in feed
        feed_response = auth_session.get(f"{BASE_URL}/api/posts")
        posts = feed_response.json()
        found = any(p["id"] == post["id"] for p in posts)
        assert found, "Created post not found in feed"
        print("✓ Post verified in feed")


class TestLikePost:
    """Test POST /api/posts/{post_id}/like - like/unlike"""
    
    def test_like_post(self, auth_session):
        """Like a post and verify count increases"""
        # Get first post from feed
        feed_response = auth_session.get(f"{BASE_URL}/api/posts")
        posts = feed_response.json()
        
        if len(posts) == 0:
            pytest.skip("No posts available to like")
        
        post_id = posts[0]["id"]
        initial_likes = posts[0]["likes_count"]
        was_liked = posts[0]["is_liked"]
        
        # Like/unlike
        response = auth_session.post(f"{BASE_URL}/api/posts/{post_id}/like")
        assert response.status_code == 200
        result = response.json()
        
        # Verify toggle
        expected_liked = not was_liked
        assert result["liked"] == expected_liked
        
        # Verify in feed
        verify_response = auth_session.get(f"{BASE_URL}/api/posts")
        updated_post = next(p for p in verify_response.json() if p["id"] == post_id)
        assert updated_post["is_liked"] == expected_liked
        
        # Toggle back
        auth_session.post(f"{BASE_URL}/api/posts/{post_id}/like")
        print(f"✓ Post {post_id} like toggled from {was_liked} to {expected_liked}")


class TestComments:
    """Test POST/GET /api/posts/{post_id}/comments"""
    
    def test_add_comment_to_post(self, auth_session):
        """Add comment to a post"""
        # Get first post
        feed_response = auth_session.get(f"{BASE_URL}/api/posts")
        posts = feed_response.json()
        
        if len(posts) == 0:
            pytest.skip("No posts available to comment on")
        
        post_id = posts[0]["id"]
        timestamp = datetime.now().strftime("%H:%M:%S")
        comment_text = f"TEST_Comment at {timestamp}"
        
        # Add comment
        response = auth_session.post(
            f"{BASE_URL}/api/posts/{post_id}/comments",
            json={"text": comment_text}
        )
        
        assert response.status_code == 200, f"Add comment failed: {response.text}"
        comment = response.json()
        
        assert comment["text"] == comment_text
        assert "id" in comment
        assert "user" in comment
        
        created_test_data["comment_id"] = comment["id"]
        created_test_data["commented_post_id"] = post_id
        print(f"✓ Added comment to post {post_id}")
    
    def test_get_post_comments(self, auth_session):
        """GET /api/posts/{post_id}/comments"""
        post_id = created_test_data.get("commented_post_id")
        
        if not post_id:
            # Use any post
            feed_response = auth_session.get(f"{BASE_URL}/api/posts")
            posts = feed_response.json()
            if len(posts) == 0:
                pytest.skip("No posts available")
            post_id = posts[0]["id"]
        
        response = auth_session.get(f"{BASE_URL}/api/posts/{post_id}/comments")
        
        assert response.status_code == 200
        comments = response.json()
        assert isinstance(comments, list)
        
        print(f"✓ GET /api/posts/{post_id}/comments returned {len(comments)} comments")


class TestUserPosts:
    """Test GET /api/users/{user_id}/posts - user specific posts"""
    
    def test_get_user_posts(self, auth_session):
        """Get posts by specific user"""
        user_id = auth_session.user["id"]
        
        response = auth_session.get(f"{BASE_URL}/api/users/{user_id}/posts")
        
        assert response.status_code == 200
        posts = response.json()
        assert isinstance(posts, list)
        
        # All posts should belong to this user
        for post in posts:
            assert post["user_id"] == user_id
        
        print(f"✓ GET /api/users/{user_id}/posts returned {len(posts)} posts")


# ==================== STORIES TESTS ====================

class TestStories:
    """Test GET /api/stories - returns grouped by user"""
    
    def test_get_stories_grouped(self, auth_session):
        """GET /api/stories should return stories grouped by user"""
        response = auth_session.get(f"{BASE_URL}/api/stories")
        
        assert response.status_code == 200
        story_groups = response.json()
        assert isinstance(story_groups, list)
        
        print(f"✓ GET /api/stories returned {len(story_groups)} user story groups")
        
        # Verify structure if there are stories
        if len(story_groups) > 0:
            group = story_groups[0]
            assert "user_id" in group
            assert "username" in group
            assert "stories" in group
            assert isinstance(group["stories"], list)
            print(f"✓ Story group structure verified: user={group['username']}, stories={len(group['stories'])}")


# ==================== DANCE CATEGORIES TESTS ====================

class TestDanceCategories:
    """Test GET /api/dance-categories"""
    
    def test_get_dance_categories(self, auth_session):
        """GET /api/dance-categories - returns default categories"""
        response = auth_session.get(f"{BASE_URL}/api/dance-categories")
        
        assert response.status_code == 200
        categories = response.json()
        
        assert isinstance(categories, list)
        assert len(categories) > 0
        
        # Verify structure
        category = categories[0]
        assert "id" in category
        assert "name" in category
        assert "image_url" in category
        
        print(f"✓ GET /api/dance-categories returned {len(categories)} categories")
        print(f"  Categories: {[c['name'] for c in categories[:3]]}...")


# ==================== AVAILABLE TEACHERS TESTS ====================

class TestAvailableTeachers:
    """Test GET /api/available-teachers"""
    
    def test_get_available_teachers(self, auth_session):
        """GET /api/available-teachers - returns available teachers"""
        response = auth_session.get(f"{BASE_URL}/api/available-teachers")
        
        assert response.status_code == 200
        teachers = response.json()
        assert isinstance(teachers, list)
        
        print(f"✓ GET /api/available-teachers returned {len(teachers)} teachers")
        
        # Verify structure if there are teachers
        if len(teachers) > 0:
            teacher = teachers[0]
            assert "id" in teacher
            assert "username" in teacher
            assert "name" in teacher
            assert "rating" in teacher
            assert "hourly_rate" in teacher
            print(f"✓ Teacher structure verified")


# ==================== LIVE SESSIONS TESTS ====================

class TestLiveSessions:
    """Test live session endpoints"""
    
    def test_request_live_session(self, auth_session):
        """POST /api/live-sessions/request - request session with teacher"""
        # First need an available teacher
        # Make current user available first
        auth_session.post(f"{BASE_URL}/api/users/me/toggle-availability")
        
        # Get available teachers (need another user)
        teachers_response = auth_session.get(f"{BASE_URL}/api/available-teachers")
        teachers = teachers_response.json()
        
        if len(teachers) == 0:
            # No teachers available - skip or test error case
            print("⚠ No available teachers for session request test")
            # Verify error for self-request
            own_id = auth_session.user["id"]
            response = auth_session.post(
                f"{BASE_URL}/api/live-sessions/request",
                json={"teacher_id": own_id}
            )
            assert response.status_code == 400  # Cannot request with self
            print("✓ Self-session request correctly rejected")
        else:
            teacher_id = teachers[0]["id"]
            response = auth_session.post(
                f"{BASE_URL}/api/live-sessions/request",
                json={"teacher_id": teacher_id}
            )
            assert response.status_code == 200
            session = response.json()
            assert "id" in session
            assert session["status"] == "pending"
            created_test_data["live_session_id"] = session["id"]
            print(f"✓ Live session requested with teacher {teacher_id}")
    
    def test_get_pending_sessions(self, auth_session):
        """GET /api/live-sessions/pending - get pending sessions for teacher"""
        response = auth_session.get(f"{BASE_URL}/api/live-sessions/pending")
        
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
        print(f"✓ GET /api/live-sessions/pending returned {len(sessions)} sessions")
    
    def test_get_pending_sessions_count(self, auth_session):
        """GET /api/live-sessions/pending/count - count pending sessions"""
        response = auth_session.get(f"{BASE_URL}/api/live-sessions/pending/count")
        
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"✓ Pending sessions count: {data['count']}")


# ==================== FILE UPLOAD TESTS ====================

class TestFileUpload:
    """Test POST /api/upload and GET /api/media/{filename}"""
    
    def test_upload_image_file(self, auth_session):
        """POST /api/upload - upload image file"""
        # 1x1 PNG
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
        )
        
        files = {"file": ("test_upload.png", png_data, "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": auth_session.headers["Authorization"]},
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "url" in data
        assert "filename" in data
        assert data["url"].startswith("/api/uploads/")
        
        created_test_data["uploaded_image_url"] = data["url"]
        print(f"✓ Image uploaded: {data['url']}")
    
    def test_media_streaming_endpoint(self, auth_session):
        """GET /api/media/{filename} - media streaming"""
        uploaded_url = created_test_data.get("uploaded_image_url")
        
        if not uploaded_url:
            pytest.skip("No uploaded file to test streaming")
        
        # Extract filename from /api/uploads/xxx.png
        filename = uploaded_url.replace("/api/uploads/", "")
        
        response = requests.get(f"{BASE_URL}/api/media/{filename}")
        
        assert response.status_code == 200
        # Images return FileResponse, videos return JSON with data_url
        # Since we uploaded an image, expect file content
        assert len(response.content) > 0
        print(f"✓ Media streaming endpoint returned file for {filename}")
    
    def test_static_uploads_accessible(self, auth_session):
        """Verify /api/uploads/{filename} is accessible"""
        uploaded_url = created_test_data.get("uploaded_image_url")
        
        if not uploaded_url:
            pytest.skip("No uploaded file to test access")
        
        # Static file endpoint (without auth)
        response = requests.get(f"{BASE_URL}{uploaded_url}")
        
        assert response.status_code == 200
        print(f"✓ Static file accessible at {uploaded_url}")


# ==================== HEALTH CHECK ====================

class TestHealthCheck:
    """Test health/root endpoints"""
    
    def test_api_root(self):
        """GET /api/ - API root"""
        response = requests.get(f"{BASE_URL}/api/")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root: {data['message']}")
    
    def test_health_endpoint(self):
        """GET /api/health"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
