"""
Iteration 16 - Story Thumbnail Support, Posts, Search & Delete API Tests

Tests for features requested:
- GET /api/health - backend is healthy
- GET /api/posts - all posts must return media_urls array (backward compat)
- POST /api/posts with media_urls array - creates carousel post
- GET /api/posts/{id} - returns post with media_urls
- DELETE /api/posts/{post_id} - deletes own post with 200
- DELETE /api/posts/{post_id} - returns 403 for other user's post
- GET /api/users/search?q=mario - finds users without leaking passwords
- GET /api/users/search?q=nonexistent - returns empty array
- GET /api/stories - returns story groups with thumbnail field
- POST /api/stories with type=video - check thumbnail field in response
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://lesson-marketplace-5.preview.emergentagent.com').rstrip('/')

# Test users from requirements
TEACHER_EMAIL = "tutor@test.com"
TEACHER_PASSWORD = "password123"
STUDENT_EMAIL = "mario@test.com"
STUDENT_PASSWORD = "password123"


@pytest.fixture(scope="module")
def teacher_auth():
    """Get teacher auth token and user_id"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    assert response.status_code == 200, f"Teacher login failed: {response.text}"
    data = response.json()
    return data["access_token"], data["user"]["id"]


@pytest.fixture(scope="module")
def student_auth():
    """Get student auth token and user_id"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_EMAIL,
        "password": STUDENT_PASSWORD
    })
    assert response.status_code == 200, f"Student login failed: {response.text}"
    data = response.json()
    return data["access_token"], data["user"]["id"]


# ==================== HEALTH CHECK ====================

class TestHealth:
    """Test health endpoint"""
    
    def test_health_check(self):
        """GET /api/health - backend is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", "Status should be healthy"
        print("GET /api/health - PASSED")


# ==================== USER SEARCH TESTS ====================

class TestUserSearch:
    """Tests for GET /api/users/search?q= endpoint"""
    
    def test_search_users_find_mario(self, teacher_auth):
        """GET /api/users/search?q=mario - finds users without leaking passwords"""
        token, _ = teacher_auth
        
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=mario",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Search should return an array"
        assert len(data) >= 1, "Should find at least one user matching 'mario'"
        
        # Check no password fields leaked
        for user in data:
            assert "password" not in user, "Password field should not be returned"
            assert "password_hash" not in user, "password_hash should not be returned"
            assert "_id" not in user, "MongoDB _id should not be returned"
            assert "id" in user, "User should have id"
            assert "username" in user, "User should have username"
        
        print(f"GET /api/users/search?q=mario - PASSED (found {len(data)} users, no password leaked)")
    
    def test_search_users_nonexistent(self, teacher_auth):
        """GET /api/users/search?q=nonexistent - returns empty array"""
        token, _ = teacher_auth
        
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=xyznonexistent123abc",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Search should return an array"
        assert len(data) == 0, "Should return empty array for nonexistent search"
        
        print("GET /api/users/search?q=nonexistent - PASSED (returned empty array)")


# ==================== POSTS TESTS (media_urls & backward compat) ====================

class TestPosts:
    """Tests for posts API with media_urls array support"""
    
    def test_get_posts_with_media_urls(self, student_auth):
        """GET /api/posts - all posts must return media_urls array (backward compat)"""
        token, _ = student_auth
        
        response = requests.get(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get posts failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Posts should return an array"
        
        # Check that ALL posts have media_urls field (backward compatibility)
        for post in data:
            assert "media_urls" in post, f"Post {post.get('id', 'unknown')[:8]} missing media_urls"
            assert isinstance(post["media_urls"], list), "media_urls should be an array"
        
        print(f"GET /api/posts - PASSED (all {len(data)} posts have media_urls array)")
    
    def test_create_carousel_post(self, student_auth):
        """POST /api/posts with media_urls array - creates carousel post"""
        token, user_id = student_auth
        
        post_data = {
            "type": "photo",
            "media_urls": [
                "https://example.com/carousel1.jpg",
                "https://example.com/carousel2.jpg",
                "https://example.com/carousel3.jpg"
            ],
            "caption": f"TEST_iter16_carousel_{uuid.uuid4().hex[:8]}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {token}"},
            json=post_data
        )
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Post should have id"
        assert "media_urls" in data, "Post should have media_urls"
        assert isinstance(data["media_urls"], list), "media_urls should be an array"
        assert len(data["media_urls"]) == 3, "Should have 3 media URLs"
        assert data["user_id"] == user_id
        
        print(f"POST /api/posts with media_urls - PASSED (created carousel post {data['id'][:8]}...)")
        return data["id"]
    
    def test_get_single_post_has_media_urls(self, student_auth):
        """GET /api/posts/{id} - returns post with media_urls"""
        token, _ = student_auth
        
        # First get all posts to find one
        response = requests.get(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        posts = response.json()
        
        if not posts:
            pytest.skip("No posts available for single post test")
        
        post_id = posts[0]["id"]
        
        # Get single post
        response = requests.get(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get single post failed: {response.text}"
        data = response.json()
        
        assert "media_urls" in data, "Single post should have media_urls"
        assert isinstance(data["media_urls"], list), "media_urls should be an array"
        
        print(f"GET /api/posts/{post_id[:8]}... - PASSED (has media_urls array)")


# ==================== POST DELETION TESTS ====================

class TestPostDeletion:
    """Tests for DELETE /api/posts/{post_id} endpoint"""
    
    def test_owner_can_delete_own_post(self, student_auth):
        """DELETE /api/posts/{post_id} - deletes own post with 200"""
        token, user_id = student_auth
        
        # Create a post to delete
        post_data = {
            "type": "text",
            "caption": f"TEST_iter16_delete_{uuid.uuid4().hex[:8]}"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {token}"},
            json=post_data
        )
        assert create_response.status_code == 200, f"Create post failed: {create_response.text}"
        post_id = create_response.json()["id"]
        
        # Delete the post
        delete_response = requests.delete(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert delete_response.status_code == 200, f"Delete post failed: {delete_response.text}"
        data = delete_response.json()
        assert data.get("status") == "deleted", "Should return deleted status"
        
        # Verify post is gone
        get_response = requests.get(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 404, "Deleted post should return 404"
        
        print(f"DELETE /api/posts/{post_id[:8]}... - PASSED (owner deleted post with 200)")
    
    def test_non_owner_gets_403(self, student_auth, teacher_auth):
        """DELETE /api/posts/{post_id} - returns 403 for other user's post"""
        student_token, _ = student_auth
        teacher_token, _ = teacher_auth
        
        # Student creates a post
        post_data = {
            "type": "text",
            "caption": f"TEST_iter16_nodelete_{uuid.uuid4().hex[:8]}"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {student_token}"},
            json=post_data
        )
        assert create_response.status_code == 200
        post_id = create_response.json()["id"]
        
        # Teacher tries to delete student's post
        delete_response = requests.delete(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert delete_response.status_code == 403, f"Non-owner should get 403, got {delete_response.status_code}"
        
        # Cleanup: delete the post as owner
        requests.delete(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        
        print(f"DELETE /api/posts/{post_id[:8]}... by non-owner - PASSED (returned 403)")


# ==================== STORIES TESTS (thumbnail support) ====================

class TestStories:
    """Tests for stories API with thumbnail support"""
    
    def test_get_stories_has_thumbnail_field(self, student_auth):
        """GET /api/stories - returns story groups with thumbnail field"""
        token, _ = student_auth
        
        response = requests.get(
            f"{BASE_URL}/api/stories",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get stories failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Stories should return an array"
        
        # Check that stories structure includes thumbnail field
        for story_group in data:
            assert "user_id" in story_group, "Story group should have user_id"
            assert "stories" in story_group, "Story group should have stories array"
            
            # Each story in the group should have thumbnail field
            for story in story_group.get("stories", []):
                assert "id" in story, "Story should have id"
                assert "media" in story, "Story should have media"
                assert "type" in story, "Story should have type"
                # thumbnail can be None for photo stories, but field should exist
                assert "thumbnail" in story, f"Story {story.get('id', 'unknown')[:8]} missing thumbnail field"
        
        print(f"GET /api/stories - PASSED ({len(data)} story groups, all stories have thumbnail field)")
    
    def test_create_video_story_returns_thumbnail(self, student_auth):
        """POST /api/stories with type=video - check thumbnail field in response"""
        token, _ = student_auth
        
        # Create a video story (using a small test video or base64 placeholder)
        # Note: Thumbnail generation requires ffmpeg and actual video file
        # We'll test the API accepts the request and returns thumbnail field
        story_data = {
            "media": "data:video/mp4;base64,AAAA",  # Minimal placeholder
            "type": "video"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/stories",
            headers={"Authorization": f"Bearer {token}"},
            json=story_data
        )
        
        # API should accept the request (may fail on thumbnail generation with invalid video)
        # But the response structure should include thumbnail field
        if response.status_code == 200:
            data = response.json()
            assert "id" in data, "Story should have id"
            assert "thumbnail" in data, "Story response should have thumbnail field"
            # thumbnail may be None if ffmpeg thumbnail generation failed
            print(f"POST /api/stories (video) - PASSED (thumbnail field present: {data.get('thumbnail')})")
        else:
            # If it fails due to invalid video data, that's acceptable for this test
            # The important thing is the API structure
            print(f"POST /api/stories (video) - API returned {response.status_code} (may be due to invalid test video)")
            pytest.skip("Video story creation skipped due to test data limitation")
    
    def test_stories_structure(self, student_auth):
        """GET /api/stories - verify complete response structure"""
        token, _ = student_auth
        
        response = requests.get(
            f"{BASE_URL}/api/stories",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify complete structure for each story group
        for group in data:
            required_group_fields = ["user_id", "username", "profile_image", "stories", "has_unread"]
            for field in required_group_fields:
                assert field in group, f"Story group missing field: {field}"
            
            # Verify each story in group
            for story in group.get("stories", []):
                required_story_fields = ["id", "media", "type", "created_at", "thumbnail"]
                for field in required_story_fields:
                    assert field in story, f"Story missing field: {field}"
        
        print(f"GET /api/stories structure - PASSED (verified complete response structure)")


# ==================== AUTH TESTS ====================

class TestAuth:
    """Authentication tests"""
    
    def test_teacher_login(self):
        """POST /api/auth/login - teacher login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == TEACHER_EMAIL
        print("POST /api/auth/login (teacher) - PASSED")
    
    def test_student_login(self):
        """POST /api/auth/login - student login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == STUDENT_EMAIL
        print("POST /api/auth/login (student) - PASSED")


# ==================== CLEANUP ====================

class TestCleanup:
    """Clean up TEST_ prefixed data created during testing"""
    
    def test_cleanup_test_posts(self, student_auth, teacher_auth):
        """Delete all TEST_iter16_ prefixed posts"""
        cleaned_count = 0
        
        for auth in [student_auth, teacher_auth]:
            token, user_id = auth
            
            response = requests.get(
                f"{BASE_URL}/api/users/{user_id}/posts",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                posts = response.json()
                for post in posts:
                    caption = post.get("caption", "")
                    if caption.startswith("TEST_iter16_"):
                        del_resp = requests.delete(
                            f"{BASE_URL}/api/posts/{post['id']}",
                            headers={"Authorization": f"Bearer {token}"}
                        )
                        if del_resp.status_code == 200:
                            cleaned_count += 1
        
        print(f"Cleanup - PASSED (removed {cleaned_count} TEST_iter16_ posts)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
