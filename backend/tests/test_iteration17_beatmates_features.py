"""
Test Suite: Iteration 17 - Beat Mates Bug Fixes & New Features

Features tested:
1. P0: Video carousel nei Reels - backend returns videos from carousel posts (media_urls)
2. P0: Tab Shop (video lessons) - /api/users/{id}/video-lessons endpoint
3. Ricerca fuzzy - /api/users/search with typos like "tutro" or "totur"
4. Selezione thumbnail personalizzata - POST /api/posts with thumbnail_url field
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://coaching-connect-8.preview.emergentagent.com')

# Test credentials
STUDENT_CREDS = {"email": "mario@test.com", "password": "password123"}
TEACHER_CREDS = {"email": "tutor@test.com", "password": "password123"}


class TestAuthAndHealth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("PASSED: Health endpoint returns healthy status")
    
    def test_login_student(self):
        """Test login with student credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == STUDENT_CREDS["email"]
        print(f"PASSED: Student login successful - {data['user']['username']}")
        return data["access_token"], data["user"]
    
    def test_login_teacher(self):
        """Test login with teacher credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == TEACHER_CREDS["email"]
        print(f"PASSED: Teacher login successful - {data['user']['username']}")
        return data["access_token"], data["user"]


class TestFuzzySearch:
    """P1: Fuzzy search tests - searching 'tutro' or 'totur' should find 'tutor'"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_exact_search_tutor(self):
        """Test exact search for 'tutor'"""
        response = requests.get(f"{BASE_URL}/api/users/search?q=tutor", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should find the tutor user
        tutor_found = any(u.get("username") == "tutor" or "tutor" in u.get("name", "").lower() for u in data)
        assert tutor_found, f"Expected to find 'tutor' user, got: {data}"
        print(f"PASSED: Exact search 'tutor' found {len(data)} results")
    
    def test_fuzzy_search_tutro(self):
        """Test fuzzy search with typo 'tutro' should find 'tutor'"""
        response = requests.get(f"{BASE_URL}/api/users/search?q=tutro", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Fuzzy search should still find 'tutor'
        tutor_found = any(
            u.get("username") == "tutor" or 
            "tutor" in u.get("name", "").lower() or
            "tutor" in u.get("username", "").lower()
            for u in data
        )
        if tutor_found:
            print(f"PASSED: Fuzzy search 'tutro' correctly found tutor user")
        else:
            print(f"WARNING: Fuzzy search 'tutro' did not find tutor. Results: {data}")
            # This is the feature we're testing - it should work
            assert tutor_found, f"Fuzzy search 'tutro' should find 'tutor', got: {data}"
    
    def test_fuzzy_search_totur(self):
        """Test fuzzy search with typo 'totur' should find 'tutor'"""
        response = requests.get(f"{BASE_URL}/api/users/search?q=totur", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Fuzzy search should still find 'tutor'
        tutor_found = any(
            u.get("username") == "tutor" or 
            "tutor" in u.get("name", "").lower() or
            "tutor" in u.get("username", "").lower()
            for u in data
        )
        if tutor_found:
            print(f"PASSED: Fuzzy search 'totur' correctly found tutor user")
        else:
            print(f"WARNING: Fuzzy search 'totur' did not find tutor. Results: {data}")
            assert tutor_found, f"Fuzzy search 'totur' should find 'tutor', got: {data}"
    
    def test_search_no_password_leak(self):
        """Ensure search results don't leak password fields"""
        response = requests.get(f"{BASE_URL}/api/users/search?q=tutor", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        for user in data:
            assert "password" not in user, f"Password field leaked in user search: {user}"
            assert "password_hash" not in user, f"Password hash leaked in user search: {user}"
        print("PASSED: User search results do not leak password fields")


class TestVideoLessonsShop:
    """P0: Test Shop tab - video lessons for other users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth tokens for both users"""
        # Student token
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        assert response.status_code == 200
        self.student_token = response.json()["access_token"]
        self.student_user = response.json()["user"]
        self.student_headers = {"Authorization": f"Bearer {self.student_token}"}
        
        # Teacher token
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
        assert response.status_code == 200
        self.teacher_token = response.json()["access_token"]
        self.teacher_user = response.json()["user"]
        self.teacher_headers = {"Authorization": f"Bearer {self.teacher_token}"}
    
    def test_get_own_video_lessons(self):
        """Test getting own video lessons"""
        teacher_id = self.teacher_user["id"]
        response = requests.get(
            f"{BASE_URL}/api/users/{teacher_id}/video-lessons",
            headers=self.teacher_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASSED: Teacher has {len(data)} video lessons")
        return data
    
    def test_get_other_user_video_lessons(self):
        """Test getting another user's video lessons (Shop tab on their profile)"""
        teacher_id = self.teacher_user["id"]
        # Student accessing teacher's video lessons
        response = requests.get(
            f"{BASE_URL}/api/users/{teacher_id}/video-lessons",
            headers=self.student_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASSED: Student can view teacher's {len(data)} video lessons (Shop tab working)")
        
        # Verify structure of video lessons
        if len(data) > 0:
            lesson = data[0]
            expected_fields = ["id", "user_id", "title", "price", "currency"]
            for field in expected_fields:
                assert field in lesson, f"Missing field '{field}' in video lesson"
            print(f"PASSED: Video lesson structure is correct: {list(lesson.keys())}")
    
    def test_get_nonexistent_user_video_lessons(self):
        """Test getting video lessons for nonexistent user returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/users/{fake_id}/video-lessons",
            headers=self.student_headers
        )
        # Should return 404 or empty list depending on implementation
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            assert response.json() == [], "Expected empty list for nonexistent user"
        print(f"PASSED: Nonexistent user returns status {response.status_code}")


class TestVideoCarouselInReels:
    """P0: Test that posts with media_urls (carousel) correctly include videos for Reels"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.user = response.json()["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_posts_with_media_urls(self):
        """Test that GET /api/posts returns media_urls array for all posts"""
        response = requests.get(f"{BASE_URL}/api/posts", headers=self.headers)
        assert response.status_code == 200
        posts = response.json()
        
        for post in posts:
            # All posts should have media_urls array
            assert "media_urls" in post, f"Post {post.get('id')} missing media_urls field"
            assert isinstance(post["media_urls"], list), f"media_urls should be array"
        
        # Check for video posts
        video_posts = [p for p in posts if p.get("type") == "video"]
        carousel_posts = [p for p in posts if len(p.get("media_urls", [])) > 1]
        
        print(f"PASSED: All {len(posts)} posts have media_urls array")
        print(f"  - Video posts: {len(video_posts)}")
        print(f"  - Carousel posts (multiple media): {len(carousel_posts)}")
    
    def test_create_video_carousel_post(self):
        """Test creating a carousel post with video URLs to appear in Reels"""
        post_data = {
            "type": "video",
            "media": "https://example.com/TEST_iter17_video1.mp4",
            "media_urls": [
                "https://example.com/TEST_iter17_video1.mp4",
                "https://example.com/TEST_iter17_image1.jpg"
            ],
            "caption": "TEST_iter17 - Video carousel test for Reels"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/posts",
            json=post_data,
            headers=self.headers
        )
        assert response.status_code == 200
        post = response.json()
        
        assert post["type"] == "video"
        assert "media_urls" in post
        assert len(post["media_urls"]) >= 1
        print(f"PASSED: Created carousel post with {len(post['media_urls'])} media items")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/posts/{post['id']}", headers=self.headers)
        print("PASSED: Test post cleaned up")


class TestCustomThumbnailSelection:
    """Test custom thumbnail selection feature for video posts"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.user = response.json()["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_post_with_custom_thumbnail(self):
        """Test creating a video post with custom thumbnail_url"""
        post_data = {
            "type": "video",
            "media": "https://example.com/TEST_iter17_video.mp4",
            "media_urls": ["https://example.com/TEST_iter17_video.mp4"],
            "caption": "TEST_iter17 - Custom thumbnail test",
            "thumbnail_url": "https://example.com/TEST_iter17_custom_thumb.jpg"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/posts",
            json=post_data,
            headers=self.headers
        )
        assert response.status_code == 200
        post = response.json()
        
        # Verify thumbnail was saved
        assert post.get("thumbnail") == "https://example.com/TEST_iter17_custom_thumb.jpg", \
            f"Expected custom thumbnail, got: {post.get('thumbnail')}"
        print(f"PASSED: Post created with custom thumbnail: {post.get('thumbnail')}")
        
        # Verify post can be retrieved with thumbnail
        get_response = requests.get(f"{BASE_URL}/api/posts/{post['id']}", headers=self.headers)
        assert get_response.status_code == 200
        retrieved_post = get_response.json()
        assert retrieved_post.get("thumbnail") == "https://example.com/TEST_iter17_custom_thumb.jpg"
        print("PASSED: Custom thumbnail persisted correctly")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/posts/{post['id']}", headers=self.headers)
        print("PASSED: Test post cleaned up")
    
    def test_post_without_custom_thumbnail(self):
        """Test that posts without custom thumbnail still work"""
        post_data = {
            "type": "photo",
            "media": "https://example.com/TEST_iter17_photo.jpg",
            "caption": "TEST_iter17 - No custom thumbnail"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/posts",
            json=post_data,
            headers=self.headers
        )
        assert response.status_code == 200
        post = response.json()
        
        # thumbnail can be None for photos
        print(f"PASSED: Post without custom thumbnail created, thumbnail={post.get('thumbnail')}")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/posts/{post['id']}", headers=self.headers)


class TestUserProfileEndpoint:
    """Test user profile endpoint used for viewing other user's profiles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.user = response.json()["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get teacher info
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
        self.teacher = response.json()["user"]
    
    def test_get_other_user_profile(self):
        """Test getting another user's profile"""
        teacher_id = self.teacher["id"]
        response = requests.get(
            f"{BASE_URL}/api/users/{teacher_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        user = response.json()
        
        # Verify profile has required fields
        required_fields = ["id", "username", "name", "followers_count", "following_count", "posts_count"]
        for field in required_fields:
            assert field in user, f"Missing field '{field}' in user profile"
        
        # Should not contain password
        assert "password" not in user
        assert "password_hash" not in user
        
        print(f"PASSED: Got user profile for {user['username']}")
    
    def test_get_other_user_posts(self):
        """Test getting another user's posts (for Posts tab)"""
        teacher_id = self.teacher["id"]
        response = requests.get(
            f"{BASE_URL}/api/users/{teacher_id}/posts",
            headers=self.headers
        )
        assert response.status_code == 200
        posts = response.json()
        assert isinstance(posts, list)
        
        # All posts should have media_urls
        for post in posts:
            assert "media_urls" in post
        
        print(f"PASSED: Got {len(posts)} posts for other user's profile")


class TestStoriesForProfileClick:
    """Test stories endpoint - clicking profile photo should show stories"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.user = response.json()["user"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_stories(self):
        """Test GET /api/stories returns story groups"""
        response = requests.get(f"{BASE_URL}/api/stories", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Each story group should have user info and stories array
        for story_group in data:
            assert "user_id" in story_group
            assert "username" in story_group
            assert "stories" in story_group
            assert isinstance(story_group["stories"], list)
            
            # Each story should have required fields
            for story in story_group["stories"]:
                assert "id" in story
                assert "media" in story
                assert "type" in story
        
        print(f"PASSED: Got {len(data)} story groups from /api/stories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
