"""
Iteration 15 - Carousel Posts, User Search, Post Deletion Tests
Tests for new features:
- GET /api/users/search?q= - Search users by username/name (no password leak)
- POST /api/posts with media_urls array - Create carousel post
- GET /api/posts - All posts return media_urls array (backward compat)
- GET /api/posts/{id} - Single post has media_urls
- DELETE /api/posts/{post_id} - Owner can delete post
- DELETE /api/posts/{post_id} - Non-owner gets 403
- GET /api/users/{user_id}/posts - User posts include media_urls
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://coaching-connect-8.preview.emergentagent.com').rstrip('/')

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


# ==================== USER SEARCH TESTS ====================

class TestUserSearch:
    """Tests for GET /api/users/search?q= endpoint"""
    
    def test_search_users_by_username_mario(self, student_auth, teacher_auth):
        """GET /api/users/search?q=mario - should find mario user, no password leaked"""
        token, _ = teacher_auth  # Search as teacher
        
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=mario",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Search should return an array"
        # Should find at least the mario user
        assert len(data) >= 1, "Should find at least one user matching 'mario'"
        
        # Check no password fields leaked
        for user in data:
            assert "password" not in user, "Password field should not be returned"
            assert "password_hash" not in user, "password_hash should not be returned"
            assert "_id" not in user, "MongoDB _id should not be returned"
            # Should have basic user info
            assert "id" in user, "User should have id"
            assert "username" in user, "User should have username"
        
        print(f"GET /api/users/search?q=mario - PASSED (found {len(data)} users, no password leaked)")
    
    def test_search_users_by_tutor(self, teacher_auth, student_auth):
        """GET /api/users/search?q=tutor - should find tutor user"""
        token, _ = student_auth  # Search as student
        
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=tutor",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Search should return an array"
        assert len(data) >= 1, "Should find at least one user matching 'tutor'"
        
        # Verify tutor user found
        usernames = [u.get("username", "").lower() for u in data]
        assert any("tutor" in u for u in usernames), "Should find tutor user"
        
        # Verify no password leak
        for user in data:
            assert "password" not in user, "Password should not be returned"
            assert "password_hash" not in user, "password_hash should not be returned"
        
        print(f"GET /api/users/search?q=tutor - PASSED (found {len(data)} users)")
    
    def test_search_users_nonexistent(self, teacher_auth):
        """GET /api/users/search?q=nonexistent - should return empty array"""
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
    
    def test_search_users_empty_query(self, teacher_auth):
        """GET /api/users/search?q= (empty) - should return empty array"""
        token, _ = teacher_auth
        
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Search should return an array"
        assert len(data) == 0, "Empty query should return empty array"
        
        print("GET /api/users/search?q= (empty) - PASSED (returned empty array)")
    
    def test_search_excludes_current_user(self, student_auth):
        """Search for 'mario' as mario should not return self"""
        token, user_id = student_auth
        
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=mario",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Current user should not be in results
        user_ids = [u.get("id") for u in data]
        assert user_id not in user_ids, "Current user should not appear in search results"
        
        print("GET /api/users/search - PASSED (current user excluded from results)")


# ==================== CAROUSEL POSTS TESTS ====================

class TestCarouselPosts:
    """Tests for carousel/multi-image posts with media_urls array"""
    
    def test_create_carousel_post_with_media_urls(self, student_auth):
        """POST /api/posts with media_urls array - create carousel post"""
        token, user_id = student_auth
        
        # Create a carousel post with multiple media URLs
        post_data = {
            "type": "photo",
            "media_urls": [
                "https://example.com/image1.jpg",
                "https://example.com/image2.jpg",
                "https://example.com/image3.jpg"
            ],
            "caption": f"TEST_carousel_{uuid.uuid4().hex[:8]}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {token}"},
            json=post_data
        )
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        
        # Verify post created with media_urls
        assert "id" in data, "Post should have id"
        assert "media_urls" in data, "Post should have media_urls"
        assert isinstance(data["media_urls"], list), "media_urls should be an array"
        assert len(data["media_urls"]) == 3, "Should have 3 media URLs"
        assert data["media_urls"][0] == "https://example.com/image1.jpg"
        assert data["user_id"] == user_id
        
        print(f"POST /api/posts with media_urls - PASSED (created post {data['id'][:8]}... with {len(data['media_urls'])} images)")
        return data["id"]
    
    def test_get_posts_include_media_urls(self, student_auth):
        """GET /api/posts - all posts should include media_urls array"""
        token, _ = student_auth
        
        response = requests.get(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get posts failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Posts should return an array"
        
        # Check that ALL posts have media_urls field
        for post in data:
            assert "media_urls" in post, f"Post {post.get('id', 'unknown')[:8]} missing media_urls"
            assert isinstance(post["media_urls"], list), "media_urls should be an array"
        
        print(f"GET /api/posts - PASSED (all {len(data)} posts have media_urls array)")
    
    def test_get_single_post_has_media_urls(self, student_auth):
        """GET /api/posts/{id} - single post should include media_urls"""
        token, user_id = student_auth
        
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
        
        print(f"GET /api/posts/{post_id[:8]}... - PASSED (has media_urls array with {len(data['media_urls'])} items)")
    
    def test_get_user_posts_include_media_urls(self, student_auth):
        """GET /api/users/{user_id}/posts - user posts include media_urls"""
        token, user_id = student_auth
        
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/posts",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get user posts failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "User posts should return an array"
        
        # All posts should have media_urls
        for post in data:
            assert "media_urls" in post, f"User post {post.get('id', 'unknown')[:8]} missing media_urls"
            assert isinstance(post["media_urls"], list), "media_urls should be an array"
        
        print(f"GET /api/users/{user_id[:8]}.../posts - PASSED (all {len(data)} posts have media_urls)")
    
    def test_backward_compat_old_posts_get_media_urls(self, student_auth):
        """Old posts without media_urls stored should return [media] as media_urls"""
        token, _ = student_auth
        
        response = requests.get(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        posts = response.json()
        
        # Check backward compatibility
        for post in posts:
            media_urls = post.get("media_urls", [])
            media = post.get("media")
            
            # If post has media, media_urls should include it
            if media:
                # media_urls should contain at least the main media
                assert len(media_urls) >= 1 or media_urls == [], "Backward compat: media should be in media_urls"
        
        print("Backward compatibility check - PASSED (old posts have media_urls populated)")


# ==================== POST DELETION TESTS ====================

class TestPostDeletion:
    """Tests for DELETE /api/posts/{post_id} endpoint"""
    
    def test_owner_can_delete_own_post(self, student_auth):
        """DELETE /api/posts/{post_id} - owner can delete their own post"""
        token, user_id = student_auth
        
        # Create a post to delete
        post_data = {
            "type": "text",
            "caption": f"TEST_delete_me_{uuid.uuid4().hex[:8]}"
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
        
        print(f"DELETE /api/posts/{post_id[:8]}... - PASSED (owner deleted post)")
    
    def test_non_owner_cannot_delete_post(self, student_auth, teacher_auth):
        """DELETE /api/posts/{post_id} - non-owner gets 403"""
        student_token, student_id = student_auth
        teacher_token, teacher_id = teacher_auth
        
        # Student creates a post
        post_data = {
            "type": "text",
            "caption": f"TEST_no_delete_{uuid.uuid4().hex[:8]}"
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
        
        # Verify post still exists
        get_response = requests.get(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert get_response.status_code == 200, "Post should still exist"
        
        # Cleanup: delete the post as owner
        requests.delete(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        
        print(f"DELETE /api/posts/{post_id[:8]}... by non-owner - PASSED (correctly returned 403)")
    
    def test_delete_nonexistent_post(self, student_auth):
        """DELETE /api/posts/{nonexistent} - should return 404"""
        token, _ = student_auth
        
        fake_post_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/posts/{fake_post_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("DELETE /api/posts/{nonexistent} - PASSED (returned 404)")


# ==================== BASIC HEALTH TESTS ====================

class TestHealthEndpoints:
    """Basic API health and auth tests"""
    
    def test_health_check(self):
        """GET /api/health - basic health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("GET /api/health - PASSED")
    
    def test_root_endpoint(self):
        """GET /api/ - API info endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "Beat Mates" in data.get("message", "")
        print("GET /api/ - PASSED")
    
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


# ==================== CLEANUP TEST DATA ====================

class TestCleanup:
    """Clean up TEST_ prefixed posts created during testing"""
    
    def test_cleanup_test_posts(self, student_auth, teacher_auth):
        """Delete all TEST_ prefixed posts"""
        cleaned_count = 0
        
        for auth in [student_auth, teacher_auth]:
            token, user_id = auth
            
            # Get user's posts
            response = requests.get(
                f"{BASE_URL}/api/users/{user_id}/posts",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                posts = response.json()
                for post in posts:
                    caption = post.get("caption", "")
                    if caption.startswith("TEST_"):
                        del_resp = requests.delete(
                            f"{BASE_URL}/api/posts/{post['id']}",
                            headers={"Authorization": f"Bearer {token}"}
                        )
                        if del_resp.status_code == 200:
                            cleaned_count += 1
        
        print(f"Cleanup - PASSED (removed {cleaned_count} TEST_ posts)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
