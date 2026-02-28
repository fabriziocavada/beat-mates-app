"""
Beat Mates API Tests - Iteration 2
Tests for new features: video upload, notification banner polling, clean database state
Previous iteration tested: login, image upload, posts, stories, profile - all passed
"""
import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "mario@test.com"
TEST_PASSWORD = "password123"


class TestPendingSessionCount:
    """Tests for live-sessions/pending/count endpoint - used by LessonNotificationBanner"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data["access_token"]
            self.user_id = data["user"]["id"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping pending session tests")
    
    def test_get_pending_count(self):
        """Test GET /api/live-sessions/pending/count returns count (should be 0 for fresh db)"""
        response = requests.get(f"{BASE_URL}/api/live-sessions/pending/count", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"✓ Pending sessions count: {data['count']}")
    
    def test_get_pending_sessions_list(self):
        """Test GET /api/live-sessions/pending returns list"""
        response = requests.get(f"{BASE_URL}/api/live-sessions/pending", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Pending sessions list returned: {len(data)} sessions")


class TestVideoUpload:
    """Test video upload functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping video upload tests")
    
    def test_upload_video_file(self):
        """Test uploading a video file (mp4) via multipart"""
        # Create minimal MP4 data (this is a very small valid mp4 header)
        # For testing purposes, we'll use a small binary data
        video_data = b'\x00\x00\x00\x1c\x66\x74\x79\x70\x69\x73\x6f\x6d\x00\x00\x00\x00'  # Minimal mp4 ftyp
        
        files = {"file": ("test_video.mp4", video_data, "video/mp4")}
        response = requests.post(
            f"{BASE_URL}/api/upload",
            headers=self.headers,
            files=files
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "url" in data
        assert data["url"].startswith("/api/uploads/")
        assert data["media_type"] == "video"
        print(f"✓ Video upload successful: {data['url']}, type: {data['media_type']}")
        
        # Verify file is accessible
        file_response = requests.get(f"{BASE_URL}{data['url']}")
        assert file_response.status_code == 200
        print(f"✓ Uploaded video file is accessible at {data['url']}")


class TestCreatePostWithMedia:
    """Test post creation with photo and video URLs"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token and upload test files"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data["access_token"]
            self.user_id = data["user"]["id"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_create_photo_post_with_uploaded_image(self):
        """Test creating a photo post with uploaded image URL and verify media field"""
        import base64
        # Create test image
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
        )
        
        # Upload image
        files = {"file": ("test_photo.png", png_data, "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            headers=self.headers,
            files=files
        )
        assert upload_response.status_code == 200
        image_url = upload_response.json()["url"]
        
        # Create post with image URL
        timestamp = datetime.now().strftime("%H:%M:%S")
        caption = f"TEST_Photo post at {timestamp}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/posts",
            headers=self.headers,
            json={
                "type": "photo",
                "media": image_url,
                "caption": caption
            }
        )
        assert create_response.status_code == 200
        post = create_response.json()
        
        # Verify media field is stored correctly
        assert post["media"] == image_url
        assert post["type"] == "photo"
        assert post["caption"] == caption
        print(f"✓ Photo post created with media: {post['media']}")
        
        # Verify post appears in GET /api/posts
        get_response = requests.get(f"{BASE_URL}/api/posts", headers=self.headers)
        posts = get_response.json()
        found_post = next((p for p in posts if p["id"] == post["id"]), None)
        assert found_post is not None
        assert found_post["media"] == image_url
        print(f"✓ Photo post verified in posts list with correct media URL")
    
    def test_create_video_post_with_uploaded_video(self):
        """Test creating a video post and verify type=video and media stored"""
        # Upload video file
        video_data = b'\x00\x00\x00\x1c\x66\x74\x79\x70\x69\x73\x6f\x6d\x00\x00\x00\x00'
        files = {"file": ("test_video.mp4", video_data, "video/mp4")}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            headers=self.headers,
            files=files
        )
        assert upload_response.status_code == 200
        video_url = upload_response.json()["url"]
        
        # Create video post
        timestamp = datetime.now().strftime("%H:%M:%S")
        caption = f"TEST_Video post at {timestamp}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/posts",
            headers=self.headers,
            json={
                "type": "video",
                "media": video_url,
                "caption": caption
            }
        )
        assert create_response.status_code == 200
        post = create_response.json()
        
        # Verify video post fields
        assert post["type"] == "video"
        assert post["media"] == video_url
        assert post["caption"] == caption
        print(f"✓ Video post created: type={post['type']}, media={post['media']}")
        
        # Verify in posts list
        get_response = requests.get(f"{BASE_URL}/api/posts", headers=self.headers)
        posts = get_response.json()
        found_post = next((p for p in posts if p["id"] == post["id"]), None)
        assert found_post is not None
        assert found_post["type"] == "video"
        print(f"✓ Video post verified in posts list")


class TestGetPostsAfterCleanup:
    """Test that posts endpoint works after database cleanup"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_posts_returns_created_posts(self):
        """Test GET /api/posts returns all posts including recently created ones"""
        response = requests.get(f"{BASE_URL}/api/posts", headers=self.headers)
        assert response.status_code == 200
        posts = response.json()
        
        assert isinstance(posts, list)
        print(f"✓ GET /api/posts returned {len(posts)} posts")
        
        # Check each post has required fields
        for post in posts:
            assert "id" in post
            assert "user_id" in post
            assert "type" in post
            assert "user" in post
            # Verify user object structure
            if post["user"]:
                assert "username" in post["user"]
        
        print(f"✓ All {len(posts)} posts have valid structure")


class TestStaticFileServingUploads:
    """Test that uploaded files are accessible at /api/uploads/{filename}"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_uploaded_files_publicly_accessible(self):
        """Test that uploaded files can be accessed without auth (static serving)"""
        import base64
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
        )
        
        files = {"file": ("public_test.png", png_data, "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            headers=self.headers,
            files=files
        )
        assert upload_response.status_code == 200
        url = upload_response.json()["url"]
        
        # Access WITHOUT auth (static files should be public)
        public_response = requests.get(f"{BASE_URL}{url}")
        assert public_response.status_code == 200
        assert len(public_response.content) > 0
        print(f"✓ Uploaded file publicly accessible at {url}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
