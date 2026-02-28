"""
Beat Mates API Tests
Tests for login, file upload, posts, stories, users, and static file serving
"""
import pytest
import requests
import os
from pathlib import Path
from datetime import datetime

# Get BASE_URL from environment - should be the public preview URL
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', os.environ.get('REACT_APP_BACKEND_URL', '')).rstrip('/')

# Test credentials
TEST_EMAIL = "mario@test.com"
TEST_PASSWORD = "password123"


class TestHealthCheck:
    """Health check and basic API availability"""
    
    def test_api_health(self):
        """Test health endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")

    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "Beat Mates" in data.get("message", "")
        print(f"✓ API root accessible: {data}")


class TestAuthentication:
    """Authentication endpoints tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert "id" in data["user"]
        print(f"✓ Login successful for {TEST_EMAIL}, token received")
        return data

    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials properly rejected")

    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "password123"
        })
        assert response.status_code == 401
        print("✓ Non-existent user properly rejected")


class TestFileUpload:
    """File upload endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping upload tests")
    
    def test_upload_image(self):
        """Test uploading an image file"""
        # Create a simple test image (1x1 red pixel PNG)
        import base64
        # Minimal valid PNG
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
        )
        
        files = {"file": ("test_image.png", png_data, "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/upload",
            headers=self.headers,
            files=files
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate response
        assert "url" in data
        assert data["url"].startswith("/api/uploads/")
        assert "filename" in data
        print(f"✓ Image upload successful: {data['url']}")
        
        # Verify file is accessible
        file_response = requests.get(f"{BASE_URL}{data['url']}")
        assert file_response.status_code == 200
        print(f"✓ Uploaded file is accessible at {data['url']}")

    def test_upload_without_auth(self):
        """Test upload without authentication fails"""
        import base64
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
        )
        files = {"file": ("test.png", png_data, "image/png")}
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        assert response.status_code in [401, 403]
        print("✓ Upload without auth properly rejected")


class TestPosts:
    """Posts CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token and user info"""
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
            pytest.skip("Authentication failed - skipping post tests")
    
    def test_get_posts(self):
        """Test getting all posts"""
        response = requests.get(f"{BASE_URL}/api/posts", headers=self.headers)
        assert response.status_code == 200
        posts = response.json()
        assert isinstance(posts, list)
        print(f"✓ Got {len(posts)} posts")
        
        # Check post structure if posts exist
        if posts:
            post = posts[0]
            assert "id" in post
            assert "user_id" in post
            assert "type" in post
            print(f"✓ Post structure valid: id={post['id'][:8]}...")
    
    def test_create_post_text_only(self):
        """Test creating a text-only post"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        caption = f"TEST_Post created at {timestamp}"
        
        response = requests.post(
            f"{BASE_URL}/api/posts",
            headers=self.headers,
            json={
                "type": "photo",
                "media": None,
                "caption": caption
            }
        )
        assert response.status_code == 200
        post = response.json()
        
        assert post["caption"] == caption
        assert post["user_id"] == self.user_id
        print(f"✓ Text post created: {post['id'][:8]}...")
        
        # Verify post appears in posts list
        get_response = requests.get(f"{BASE_URL}/api/posts", headers=self.headers)
        posts = get_response.json()
        created_post = next((p for p in posts if p["id"] == post["id"]), None)
        assert created_post is not None
        print("✓ Created post verified in posts list")
    
    def test_create_post_with_media_url(self):
        """Test creating a post with a media URL"""
        # First upload an image
        import base64
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
        )
        files = {"file": ("test.png", png_data, "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            headers=self.headers,
            files=files
        )
        assert upload_response.status_code == 200
        media_url = upload_response.json()["url"]
        
        # Create post with media URL
        response = requests.post(
            f"{BASE_URL}/api/posts",
            headers=self.headers,
            json={
                "type": "photo",
                "media": media_url,
                "caption": "TEST_Post with uploaded media"
            }
        )
        assert response.status_code == 200
        post = response.json()
        assert post["media"] == media_url
        print(f"✓ Post with media created: media={media_url}")
    
    def test_get_user_posts(self):
        """Test getting posts for a specific user"""
        response = requests.get(
            f"{BASE_URL}/api/users/{self.user_id}/posts",
            headers=self.headers
        )
        assert response.status_code == 200
        posts = response.json()
        assert isinstance(posts, list)
        
        # All posts should belong to the user
        for post in posts:
            assert post["user_id"] == self.user_id
        print(f"✓ Got {len(posts)} posts for user {self.user_id[:8]}...")
    
    def test_like_post(self):
        """Test liking and unliking a post"""
        # Get posts first
        response = requests.get(f"{BASE_URL}/api/posts", headers=self.headers)
        posts = response.json()
        
        if not posts:
            pytest.skip("No posts available to like")
        
        post_id = posts[0]["id"]
        
        # Like the post
        like_response = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers=self.headers
        )
        assert like_response.status_code == 200
        result = like_response.json()
        assert "liked" in result
        print(f"✓ Post like toggled: liked={result['liked']}")


class TestStories:
    """Stories endpoints tests"""
    
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
            pytest.skip("Authentication failed - skipping story tests")
    
    def test_get_stories(self):
        """Test getting all non-expired stories"""
        response = requests.get(f"{BASE_URL}/api/stories", headers=self.headers)
        assert response.status_code == 200
        stories = response.json()
        assert isinstance(stories, list)
        print(f"✓ Got {len(stories)} story groups")
        
        # Check structure if stories exist
        if stories:
            story_group = stories[0]
            assert "user_id" in story_group
            assert "username" in story_group
            assert "stories" in story_group
            print(f"✓ Story group structure valid")
    
    def test_create_story_with_media_url(self):
        """Test creating a story with a media URL"""
        # First upload an image
        import base64
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
        )
        files = {"file": ("story.png", png_data, "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            headers=self.headers,
            files=files
        )
        assert upload_response.status_code == 200
        media_url = upload_response.json()["url"]
        
        # Create story
        response = requests.post(
            f"{BASE_URL}/api/stories",
            headers=self.headers,
            json={
                "media": media_url,
                "type": "photo"
            }
        )
        assert response.status_code == 200
        story = response.json()
        
        assert "id" in story
        assert story["media"] == media_url
        assert "expires_at" in story
        print(f"✓ Story created: {story['id'][:8]}... expires at {story['expires_at']}")
        
        # Verify story appears in stories list
        get_response = requests.get(f"{BASE_URL}/api/stories", headers=self.headers)
        stories = get_response.json()
        # Find our story in any group
        found = False
        for group in stories:
            if any(s["id"] == story["id"] for s in group.get("stories", [])):
                found = True
                break
        assert found, "Created story not found in stories list"
        print("✓ Created story verified in stories list")


class TestUserProfile:
    """User profile tests"""
    
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
            pytest.skip("Authentication failed - skipping user profile tests")
    
    def test_get_current_user(self):
        """Test getting current user profile"""
        response = requests.get(f"{BASE_URL}/api/users/me", headers=self.headers)
        assert response.status_code == 200
        user = response.json()
        
        assert user["email"] == TEST_EMAIL
        assert "id" in user
        assert "username" in user
        assert "name" in user
        print(f"✓ Current user: {user['username']} ({user['email']})")
    
    def test_update_profile_image(self):
        """Test updating profile image via PUT /api/users/me"""
        # First upload an image
        import base64
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
        )
        files = {"file": ("profile.png", png_data, "image/png")}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            headers=self.headers,
            files=files
        )
        assert upload_response.status_code == 200
        image_url = upload_response.json()["url"]
        
        # Update profile
        response = requests.put(
            f"{BASE_URL}/api/users/me",
            headers=self.headers,
            json={"profile_image": image_url}
        )
        assert response.status_code == 200
        user = response.json()
        assert user["profile_image"] == image_url
        print(f"✓ Profile image updated to: {image_url}")
        
        # Verify by fetching user again
        get_response = requests.get(f"{BASE_URL}/api/users/me", headers=self.headers)
        fetched_user = get_response.json()
        assert fetched_user["profile_image"] == image_url
        print("✓ Profile image update verified via GET")
    
    def test_get_other_user(self):
        """Test getting another user's profile"""
        response = requests.get(
            f"{BASE_URL}/api/users/{self.user_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        user = response.json()
        assert user["id"] == self.user_id
        print(f"✓ Got user profile: {user['username']}")


class TestStaticFiles:
    """Static file serving tests"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token and upload a test file"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            
            # Upload a test file
            import base64
            png_data = base64.b64decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
            )
            files = {"file": ("static_test.png", png_data, "image/png")}
            upload_response = requests.post(
                f"{BASE_URL}/api/upload",
                headers=self.headers,
                files=files
            )
            if upload_response.status_code == 200:
                self.uploaded_url = upload_response.json()["url"]
                self.filename = upload_response.json()["filename"]
            else:
                pytest.skip("Could not upload test file")
        else:
            pytest.skip("Authentication failed")
    
    def test_static_file_accessible(self):
        """Test that uploaded file is accessible at /api/uploads/{filename}"""
        response = requests.get(f"{BASE_URL}{self.uploaded_url}")
        assert response.status_code == 200
        assert len(response.content) > 0
        print(f"✓ Static file accessible at {self.uploaded_url}")
    
    def test_static_file_by_filename(self):
        """Test accessing file by /api/uploads/{filename}"""
        response = requests.get(f"{BASE_URL}/api/uploads/{self.filename}")
        assert response.status_code == 200
        print(f"✓ File accessible by filename: {self.filename}")


class TestDanceCategories:
    """Dance categories endpoint test"""
    
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
    
    def test_get_dance_categories(self):
        """Test getting dance categories"""
        response = requests.get(f"{BASE_URL}/api/dance-categories", headers=self.headers)
        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) > 0
        
        # Check structure
        cat = categories[0]
        assert "id" in cat
        assert "name" in cat
        print(f"✓ Got {len(categories)} dance categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
