"""
Iteration 8 Backend Tests - Thumbnail generation and Stories API
Tests:
1. GET /api/thumbnail/{filename} - generates and returns JPEG thumbnail from video
2. GET /api/thumbnail/{filename} - returns cached thumbnail on second call (fast)
3. GET /api/stories - returns stories grouped by user with user_id, username, profile_image, stories array
4. GET /api/users/{user_id}/posts - returns posts with type field for video/photo detection
5. POST /api/auth/login - verify login works with mario@test.com / password123
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rhythm-connect-14.preview.emergentagent.com')

# Test credentials
TEST_STUDENT = {"email": "mario@test.com", "password": "password123"}
TEST_TEACHER = {"email": "teacher@test.com", "password": "password123"}

# Known video file from uploads directory
TEST_VIDEO_FILENAME = "16ab7897-6830-4eb0-99c2-1b7f08bdae07.mp4"


class TestLogin:
    """Authentication endpoint tests - verify login works"""
    
    def test_login_student_success(self):
        """Test login with mario@test.com / password123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_STUDENT)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should have access_token field"
        assert "user" in data, "Response should have user field"
        assert data["user"]["email"] == TEST_STUDENT["email"]
        print(f"✓ Student login successful, token received")
        return data["access_token"]
    
    def test_login_teacher_success(self):
        """Test login with teacher@test.com / password123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_TEACHER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        print(f"✓ Teacher login successful")


class TestThumbnailEndpoint:
    """Tests for GET /api/thumbnail/{filename} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_STUDENT)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_thumbnail_generation_first_call(self):
        """GET /api/thumbnail/{filename} generates and returns a JPEG thumbnail from video"""
        # First call - may need to generate thumbnail
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/thumbnail/{TEST_VIDEO_FILENAME}")
        first_call_time = time.time() - start_time
        
        assert response.status_code == 200, f"Thumbnail request failed: {response.text}"
        assert response.headers.get("content-type") == "image/jpeg", \
            f"Expected image/jpeg, got {response.headers.get('content-type')}"
        
        # Verify we got actual image data (JPEG magic bytes)
        content = response.content
        assert len(content) > 100, "Thumbnail should have substantial content"
        assert content[:2] == b'\xff\xd8', "Should be a valid JPEG file"
        
        print(f"✓ Thumbnail generated successfully ({len(content)} bytes, {first_call_time:.2f}s)")
        return first_call_time
    
    def test_thumbnail_cached_second_call(self):
        """GET /api/thumbnail/{filename} returns cached thumbnail on second call (should be fast)"""
        # First call to ensure thumbnail is generated
        requests.get(f"{BASE_URL}/api/thumbnail/{TEST_VIDEO_FILENAME}")
        
        # Second call - should be from cache (much faster)
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/thumbnail/{TEST_VIDEO_FILENAME}")
        second_call_time = time.time() - start_time
        
        assert response.status_code == 200
        assert response.headers.get("content-type") == "image/jpeg"
        
        # Cached call should typically be under 0.5 seconds
        # (First call with ffmpeg can take 1-5 seconds)
        print(f"✓ Cached thumbnail returned ({second_call_time:.3f}s)")
        assert second_call_time < 2.0, f"Cached response took too long: {second_call_time}s"
    
    def test_thumbnail_nonexistent_video_returns_404(self):
        """GET /api/thumbnail/{filename} returns 404 for non-existent video"""
        response = requests.get(f"{BASE_URL}/api/thumbnail/nonexistent-video-12345.mp4")
        assert response.status_code == 404, "Should return 404 for non-existent video"
        print(f"✓ Non-existent video returns 404 correctly")


class TestStoriesEndpoint:
    """Tests for GET /api/stories endpoint - stories grouped by user"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_STUDENT)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_stories_returns_grouped_by_user(self):
        """GET /api/stories returns stories grouped by user with required fields"""
        response = requests.get(f"{BASE_URL}/api/stories", headers=self.headers)
        assert response.status_code == 200, f"Stories request failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of user story groups"
        
        print(f"✓ Stories endpoint returned {len(data)} user groups")
        
        # If there are stories, verify the structure
        if len(data) > 0:
            first_group = data[0]
            # Required fields per spec
            assert "user_id" in first_group, "Each group should have user_id"
            assert "username" in first_group, "Each group should have username"
            assert "profile_image" in first_group, "Each group should have profile_image"
            assert "stories" in first_group, "Each group should have stories array"
            
            # Stories array should have story objects
            assert isinstance(first_group["stories"], list), "stories should be an array"
            
            if len(first_group["stories"]) > 0:
                story = first_group["stories"][0]
                assert "id" in story, "Story should have id"
                assert "media" in story, "Story should have media"
                assert "type" in story, "Story should have type"
                assert "created_at" in story, "Story should have created_at"
                print(f"✓ Story structure verified: {story.get('type')} media")
            
            print(f"✓ First user group: {first_group.get('username')} with {len(first_group['stories'])} stories")
    
    def test_stories_requires_auth(self):
        """GET /api/stories without auth should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/stories")
        assert response.status_code in [401, 403], "Stories endpoint should require authentication"
        print(f"✓ Stories endpoint correctly requires authentication")


class TestUserPostsEndpoint:
    """Tests for GET /api/users/{user_id}/posts endpoint - posts with type field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_STUDENT)
        data = response.json()
        self.token = data["access_token"]
        self.user_id = data["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_user_posts_returns_type_field(self):
        """GET /api/users/{user_id}/posts returns posts with type field (video/photo)"""
        response = requests.get(f"{BASE_URL}/api/users/{self.user_id}/posts", headers=self.headers)
        assert response.status_code == 200, f"User posts request failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of posts"
        
        print(f"✓ User posts endpoint returned {len(data)} posts")
        
        # If there are posts, verify the type field exists
        if len(data) > 0:
            for i, post in enumerate(data[:3]):  # Check first 3 posts
                assert "id" in post, f"Post {i} should have id"
                assert "type" in post, f"Post {i} should have type field"
                assert post["type"] in ["photo", "video", "text"], \
                    f"Post type should be photo/video/text, got: {post['type']}"
                print(f"  Post {i}: type={post['type']}, media={'yes' if post.get('media') else 'no'}")
            
            print(f"✓ Post type field verified for {min(3, len(data))} posts")
    
    def test_user_posts_requires_auth(self):
        """GET /api/users/{user_id}/posts without auth should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/users/{self.user_id}/posts")
        assert response.status_code in [401, 403], "User posts endpoint should require authentication"
        print(f"✓ User posts endpoint correctly requires authentication")


class TestMediaEndpoint:
    """Tests for media serving endpoints"""
    
    def test_media_endpoint_serves_video(self):
        """GET /api/media/{filename} serves video file"""
        response = requests.get(f"{BASE_URL}/api/media/{TEST_VIDEO_FILENAME}")
        assert response.status_code == 200, f"Media request failed: {response.text}"
        assert "video" in response.headers.get("content-type", ""), \
            f"Expected video content-type, got {response.headers.get('content-type')}"
        print(f"✓ Media endpoint serves video correctly")
    
    def test_uploads_static_serves_video(self):
        """GET /api/uploads/{filename} serves video file (static mount)"""
        response = requests.get(f"{BASE_URL}/api/uploads/{TEST_VIDEO_FILENAME}")
        assert response.status_code == 200, f"Uploads request failed: {response.text}"
        print(f"✓ Uploads static endpoint serves video correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
