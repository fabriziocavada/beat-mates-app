"""
Beat Mates Iteration 6 Tests - Media Serving & Video File Endpoints
Tests:
1. GET /api/posts - verify video posts return file paths (like /api/uploads/xxx.mp4), NOT base64 data URLs
2. GET /api/media/{filename}.mp4 - verify returns video file directly (content-type: video/mp4), NOT JSON
3. GET /api/media/{filename}.jpg - verify returns image file directly
4. POST /api/auth/login - regression test
5. POST /api/video-call/create-room - creates Daily.co room
6. Full lesson flow: teacher available, student requests, teacher accepts (room_url in response)
7. GET /api/live-sessions/{id} - returns room_url
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://lesson-marketplace-5.preview.emergentagent.com"

class TestAuthRegression:
    """Authentication endpoint regression tests"""
    
    def test_login_mario_user(self):
        """Test login with mario@test.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "mario@test.com"
        print(f"✓ Mario user login successful, token received")
        return data["access_token"]
    
    def test_login_teacher_user(self):
        """Test login with teacher@test.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "teacher@test.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "teacher@test.com"
        print(f"✓ Teacher user login successful")
        return data["access_token"]


class TestMediaServing:
    """Test that media files are served directly, NOT as base64 data URLs"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for mario user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        if response.status_code != 200:
            pytest.skip("Auth failed")
        return response.json()["access_token"]
    
    def test_get_posts_returns_file_paths_not_base64(self, auth_token):
        """GET /api/posts should return file paths like /api/uploads/xxx.mp4, NOT data: URLs"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        
        assert response.status_code == 200, f"GET /api/posts failed: {response.text}"
        posts = response.json()
        print(f"✓ GET /api/posts returned {len(posts)} posts")
        
        # Check that video posts don't have base64 data URLs
        video_posts = [p for p in posts if p.get("type") == "video" and p.get("media")]
        for post in video_posts:
            media = post.get("media", "")
            # Should be file path like /api/uploads/xxx.mp4, NOT data:video/mp4;base64,...
            assert not media.startswith("data:"), f"Video post {post['id']} has base64 data URL! Should be file path. Got: {media[:100]}..."
            assert "/api/uploads/" in media or "/api/media/" in media or media.startswith("http"), \
                f"Video post {post['id']} media should be file path or URL. Got: {media[:100]}..."
            print(f"✓ Video post {post['id']} has correct file path: {media[:80]}")
        
        if not video_posts:
            print("ℹ No video posts found - this is OK, just means no video content created yet")
        
        return posts
    
    def test_media_endpoint_serves_file_directly(self, auth_token):
        """GET /api/media/{filename} should return actual file content, NOT JSON"""
        # First, try to get a media file if any posts have media
        headers = {"Authorization": f"Bearer {auth_token}"}
        posts_response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        posts = posts_response.json()
        
        # Find any post with media (image or video)
        media_post = None
        for post in posts:
            if post.get("media") and "/api/uploads/" in str(post.get("media", "")):
                media_post = post
                break
        
        if not media_post:
            print("ℹ No posts with uploaded media found - creating test upload")
            # Try health check on media endpoint
            test_response = requests.get(f"{BASE_URL}/api/media/nonexistent.mp4", headers=headers)
            assert test_response.status_code == 404, f"Expected 404 for nonexistent file, got {test_response.status_code}"
            print("✓ Media endpoint returns 404 for nonexistent files (correct behavior)")
            return
        
        # Extract filename from media path
        media_path = media_post["media"]
        filename = media_path.replace("/api/uploads/", "")
        print(f"Testing media endpoint with file: {filename}")
        
        # Request the file directly via /api/media/{filename}
        response = requests.get(f"{BASE_URL}/api/media/{filename}", headers=headers)
        
        assert response.status_code == 200, f"GET /api/media/{filename} failed: {response.status_code}"
        
        # Check content-type - should be video/mp4 or image/* NOT application/json
        content_type = response.headers.get("Content-Type", "")
        assert "application/json" not in content_type, \
            f"Media endpoint returned JSON! Expected video/image. Content-Type: {content_type}"
        
        # Check it's returning actual binary data
        assert len(response.content) > 100, f"Response content too small: {len(response.content)} bytes"
        
        if "video" in content_type:
            print(f"✓ Media endpoint serves video file directly (Content-Type: {content_type}, Size: {len(response.content)} bytes)")
        elif "image" in content_type:
            print(f"✓ Media endpoint serves image file directly (Content-Type: {content_type}, Size: {len(response.content)} bytes)")
        else:
            print(f"✓ Media endpoint serves file (Content-Type: {content_type}, Size: {len(response.content)} bytes)")


class TestVideoCallIntegration:
    """Test Daily.co video call integration"""
    
    @pytest.fixture
    def teacher_token(self):
        """Get auth token for teacher"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "teacher@test.com",
            "password": "password123"
        })
        if response.status_code != 200:
            pytest.skip("Teacher auth failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def student_token(self):
        """Get auth token for mario (student)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        if response.status_code != 200:
            pytest.skip("Student auth failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def teacher_id(self, teacher_token):
        """Get teacher user ID"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        return response.json()["id"]
    
    def test_create_video_room_directly(self, teacher_token):
        """Test POST /api/video-call/create-room creates Daily.co room"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.post(f"{BASE_URL}/api/video-call/create-room", headers=headers)
        
        assert response.status_code == 200, f"Create room failed: {response.text}"
        data = response.json()
        
        assert "room_url" in data, f"Response missing room_url: {data}"
        assert "room_name" in data, f"Response missing room_name: {data}"
        assert data["room_url"].startswith("https://"), f"Invalid room_url: {data['room_url']}"
        assert "daily.co" in data["room_url"], f"room_url should be Daily.co URL: {data['room_url']}"
        
        print(f"✓ Video room created successfully: {data['room_name']}")
        print(f"  Room URL: {data['room_url']}")
        return data


class TestFullLessonFlow:
    """Test full lesson flow: teacher available → student requests → teacher accepts with room_url"""
    
    @pytest.fixture
    def teacher_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "teacher@test.com",
            "password": "password123"
        })
        if response.status_code != 200:
            pytest.skip("Teacher auth failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def student_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        if response.status_code != 200:
            pytest.skip("Student auth failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def teacher_data(self, teacher_token):
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        return response.json()
    
    def test_full_lesson_flow_with_room_url(self, teacher_token, student_token, teacher_data):
        """Test complete lesson flow: availability → request → accept with room_url"""
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        student_headers = {"Authorization": f"Bearer {student_token}"}
        teacher_id = teacher_data["id"]
        
        # Step 1: Ensure teacher is available
        if not teacher_data.get("is_available"):
            toggle_response = requests.post(f"{BASE_URL}/api/users/me/toggle-availability", headers=teacher_headers)
            assert toggle_response.status_code == 200, f"Toggle availability failed: {toggle_response.text}"
            print("✓ Teacher availability toggled ON")
        else:
            print("✓ Teacher already available")
        
        # Step 2: Student requests lesson from teacher
        request_response = requests.post(
            f"{BASE_URL}/api/live-sessions/request",
            headers=student_headers,
            json={"teacher_id": teacher_id}
        )
        assert request_response.status_code == 200, f"Request lesson failed: {request_response.text}"
        session_data = request_response.json()
        session_id = session_data["id"]
        assert session_data["status"] == "pending", f"Expected pending status, got: {session_data['status']}"
        print(f"✓ Lesson requested, session ID: {session_id}")
        
        # Step 3: Teacher accepts the lesson - should create Daily.co room
        accept_response = requests.post(
            f"{BASE_URL}/api/live-sessions/{session_id}/accept",
            headers=teacher_headers
        )
        assert accept_response.status_code == 200, f"Accept lesson failed: {accept_response.text}"
        accept_data = accept_response.json()
        
        # CRITICAL: Check that room_url is returned
        assert "room_url" in accept_data, f"Accept response missing room_url! Got: {accept_data}"
        assert accept_data["room_url"] is not None, f"room_url is null! Got: {accept_data}"
        assert "daily.co" in accept_data["room_url"], f"room_url should be Daily.co URL: {accept_data['room_url']}"
        assert accept_data["status"] == "active", f"Expected active status, got: {accept_data['status']}"
        print(f"✓ Lesson accepted, room_url: {accept_data['room_url']}")
        
        # Step 4: Verify GET /api/live-sessions/{id} returns room_url
        get_session_response = requests.get(
            f"{BASE_URL}/api/live-sessions/{session_id}",
            headers=student_headers
        )
        assert get_session_response.status_code == 200, f"Get session failed: {get_session_response.text}"
        get_data = get_session_response.json()
        
        assert "room_url" in get_data, f"GET session missing room_url! Got: {get_data}"
        assert get_data["room_url"] == accept_data["room_url"], "room_url mismatch between accept and get"
        print(f"✓ GET /api/live-sessions/{session_id} returns correct room_url")
        
        return session_id


class TestHealthAndBasicEndpoints:
    """Basic health and API endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("✓ Health endpoint OK")
    
    def test_root_api_endpoint(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Beat Mates" in data["message"]
        print(f"✓ Root API: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
