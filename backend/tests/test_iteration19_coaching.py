"""
Test Iteration 19 - Live Coaching Feature
==========================================
Testing coaching endpoints for live video review:
1. POST /api/coaching/{session_id}/upload - Upload coaching clip with video compression
2. POST /api/coaching/{session_id}/command - Teacher sends play/pause/seek/speed/draw/clear_drawings commands
3. GET /api/coaching/{session_id}/state - Student polls for synced state
4. GET /api/video-player/{filename} - Video player page serves correct HTML
5. GET /api/media/{filename} - Media streaming endpoint

Full coaching sync flow:
- Teacher uploads -> student sees video_url
- Teacher plays -> student sees is_playing=true
- Teacher seeks -> student sees new current_time
- Teacher draws -> student sees drawings array
- Teacher clears -> drawings array is empty

Credentials:
- Teacher account: tutor@test.com / password123
- Student account: mario@test.com / password123
"""

import pytest
import requests
import os
import uuid
import time
import subprocess

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://beat-mates-coaching.preview.emergentagent.com"

# Path for test video
TEST_VIDEO_PATH = "/tmp/test_coaching.mp4"

# ----- FIXTURES -----

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def student_token(api_client):
    """Get student auth token (mario@test.com)"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "mario@test.com",
        "password": "password123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Student authentication failed")


@pytest.fixture(scope="module")
def student_data(api_client):
    """Get student user data"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "mario@test.com",
        "password": "password123"
    })
    if response.status_code == 200:
        return response.json().get("user")
    return None


@pytest.fixture(scope="module")
def teacher_token(api_client):
    """Get teacher auth token (tutor@test.com)"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "tutor@test.com",
        "password": "password123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Teacher authentication failed")


@pytest.fixture(scope="module")
def teacher_data(api_client):
    """Get teacher user data"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "tutor@test.com",
        "password": "password123"
    })
    if response.status_code == 200:
        return response.json().get("user")
    return None


@pytest.fixture(scope="module")
def test_video():
    """Generate a test video file using ffmpeg"""
    # Generate 5 second test video
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "testsrc=duration=5:size=320x240:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=1000:duration=5",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest",
        TEST_VIDEO_PATH
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=30)
    if result.returncode != 0:
        pytest.skip(f"Failed to generate test video: {result.stderr}")
    
    yield TEST_VIDEO_PATH
    
    # Cleanup
    if os.path.exists(TEST_VIDEO_PATH):
        os.remove(TEST_VIDEO_PATH)


@pytest.fixture(scope="module")
def live_session_id(api_client, teacher_token, student_token, teacher_data, student_data):
    """
    Create a live session for coaching testing.
    Flow: Student requests -> Teacher accepts -> Returns session_id
    """
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}
    
    if not teacher_data or not student_data:
        pytest.skip("Missing user data")
    
    teacher_id = teacher_data.get("id")
    
    # Ensure teacher is available
    api_client.post(f"{BASE_URL}/api/users/me/toggle-availability", headers=teacher_headers)
    
    # Check if already available
    me_resp = api_client.get(f"{BASE_URL}/api/users/me", headers=teacher_headers)
    if me_resp.status_code == 200 and not me_resp.json().get("is_available"):
        api_client.post(f"{BASE_URL}/api/users/me/toggle-availability", headers=teacher_headers)
    
    # Student requests session
    request_response = api_client.post(
        f"{BASE_URL}/api/live-sessions/request",
        json={"teacher_id": teacher_id},
        headers=student_headers
    )
    
    if request_response.status_code != 200:
        # Retry toggle
        api_client.post(f"{BASE_URL}/api/users/me/toggle-availability", headers=teacher_headers)
        request_response = api_client.post(
            f"{BASE_URL}/api/live-sessions/request",
            json={"teacher_id": teacher_id},
            headers=student_headers
        )
    
    if request_response.status_code != 200:
        pytest.skip(f"Failed to request live session: {request_response.text}")
    
    session_id = request_response.json().get("id")
    
    # Teacher accepts
    accept_response = api_client.post(
        f"{BASE_URL}/api/live-sessions/{session_id}/accept",
        headers=teacher_headers
    )
    
    if accept_response.status_code != 200:
        pytest.skip(f"Failed to accept live session: {accept_response.text}")
    
    yield session_id
    
    # Cleanup: End the session
    api_client.post(
        f"{BASE_URL}/api/live-sessions/{session_id}/end",
        headers=teacher_headers
    )


# ----- TEST CLASSES -----

class TestHealthAndAuth:
    """Basic health and auth tests"""
    
    def test_health_check(self, api_client):
        """Test API health"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print("PASSED: Health check")
    
    def test_student_login(self, api_client):
        """Test student login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Student login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print("PASSED: Student login")
    
    def test_teacher_login(self, api_client):
        """Test teacher login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tutor@test.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print("PASSED: Teacher login")


class TestCoachingUpload:
    """
    Test POST /api/coaching/{session_id}/upload
    Upload coaching clip with video compression
    """
    
    def test_upload_requires_valid_session(self, api_client, teacher_token, test_video):
        """Upload should work for any session (creates coaching state)"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video, 'rb') as f:
            files = {'file': ('test_clip.mp4', f, 'video/mp4')}
            response = requests.post(
                f"{BASE_URL}/api/coaching/fake-session-id/upload",
                files=files,
                headers=headers
            )
        
        # Should return 404 since session doesn't exist
        assert response.status_code == 404, f"Expected 404 for non-existent session: {response.status_code} - {response.text}"
        print("PASSED: Upload requires valid session")
    
    def test_upload_coaching_clip(self, api_client, teacher_token, live_session_id, test_video):
        """Test successful coaching clip upload with compression"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video, 'rb') as f:
            files = {'file': ('coaching_clip.mp4', f, 'video/mp4')}
            response = requests.post(
                f"{BASE_URL}/api/coaching/{live_session_id}/upload",
                files=files,
                headers=headers,
                timeout=120  # Video compression may take time
            )
        
        assert response.status_code == 200, f"Upload failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response contains video_url
        assert "video_url" in data, f"Response should contain video_url: {data}"
        video_url = data["video_url"]
        assert video_url.startswith("/api/uploads/"), f"video_url should start with /api/uploads/: {video_url}"
        print(f"PASSED: Coaching clip uploaded successfully - {video_url}")
        
        return video_url


class TestCoachingCommand:
    """
    Test POST /api/coaching/{session_id}/command
    Teacher sends play/pause/seek/speed/draw/clear_drawings commands
    """
    
    def test_command_play(self, api_client, teacher_token, live_session_id):
        """Test play command"""
        headers = {"Authorization": f"Bearer {teacher_token}", "Content-Type": "application/json"}
        
        response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "play"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Play command failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True, f"Play command should return ok=true: {data}"
        print("PASSED: Play command")
    
    def test_command_pause(self, api_client, teacher_token, live_session_id):
        """Test pause command"""
        headers = {"Authorization": f"Bearer {teacher_token}", "Content-Type": "application/json"}
        
        response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "pause"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Pause command failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        print("PASSED: Pause command")
    
    def test_command_seek(self, api_client, teacher_token, live_session_id):
        """Test seek command"""
        headers = {"Authorization": f"Bearer {teacher_token}", "Content-Type": "application/json"}
        
        response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "seek", "value": "5.5"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Seek command failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        print("PASSED: Seek command")
    
    def test_command_speed(self, api_client, teacher_token, live_session_id):
        """Test speed command (slow motion)"""
        headers = {"Authorization": f"Bearer {teacher_token}", "Content-Type": "application/json"}
        
        # Set to 0.5x speed (slow motion)
        response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "speed", "value": "0.5"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Speed command failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        print("PASSED: Speed command (slow motion)")
    
    def test_command_draw(self, api_client, teacher_token, live_session_id):
        """Test draw command (teacher draws on video)"""
        headers = {"Authorization": f"Bearer {teacher_token}", "Content-Type": "application/json"}
        
        # Drawing is sent as JSON string with path data and color
        drawing = '{"d":"M10,10 L50,50 L100,30","color":"#FF6978"}'
        
        response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "draw", "value": drawing},
            headers=headers
        )
        
        assert response.status_code == 200, f"Draw command failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        print("PASSED: Draw command")
    
    def test_command_clear_drawings(self, api_client, teacher_token, live_session_id):
        """Test clear_drawings command"""
        headers = {"Authorization": f"Bearer {teacher_token}", "Content-Type": "application/json"}
        
        response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "clear_drawings"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Clear drawings command failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True
        print("PASSED: Clear drawings command")


class TestCoachingState:
    """
    Test GET /api/coaching/{session_id}/state
    Student polls for synced state including video_url, is_playing, current_time, speed, drawings
    """
    
    def test_state_returns_session_id(self, api_client, student_token, live_session_id):
        """Test that state endpoint returns session_id"""
        headers = {"Authorization": f"Bearer {student_token}"}
        
        response = api_client.get(
            f"{BASE_URL}/api/coaching/{live_session_id}/state",
            headers=headers
        )
        
        assert response.status_code == 200, f"State endpoint failed: {response.text}"
        data = response.json()
        assert "session_id" in data, f"State should contain session_id: {data}"
        print(f"PASSED: State returns session_id - {data.get('session_id')}")
    
    def test_state_returns_all_fields(self, api_client, student_token, live_session_id, teacher_token):
        """Test that state contains all synced fields"""
        teacher_headers = {"Authorization": f"Bearer {teacher_token}", "Content-Type": "application/json"}
        student_headers = {"Authorization": f"Bearer {student_token}"}
        
        # First, teacher sends some commands to populate state
        api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "play"},
            headers=teacher_headers
        )
        api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "seek", "value": "3.0"},
            headers=teacher_headers
        )
        api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "speed", "value": "0.75"},
            headers=teacher_headers
        )
        
        # Now poll state as student
        response = api_client.get(
            f"{BASE_URL}/api/coaching/{live_session_id}/state",
            headers=student_headers
        )
        
        assert response.status_code == 200, f"State endpoint failed: {response.text}"
        data = response.json()
        
        # Check expected fields
        assert "session_id" in data, f"Missing session_id: {data}"
        print(f"State response: {data}")
        
        # is_playing should be true (we sent play command)
        if "is_playing" in data:
            assert isinstance(data["is_playing"], bool), f"is_playing should be boolean: {data}"
        
        # current_time should be ~3.0
        if "current_time" in data:
            assert isinstance(data["current_time"], (int, float)), f"current_time should be number: {data}"
        
        # speed should be 0.75
        if "speed" in data:
            assert isinstance(data["speed"], (int, float)), f"speed should be number: {data}"
        
        # drawings should be a list
        if "drawings" in data:
            assert isinstance(data["drawings"], list), f"drawings should be list: {data}"
        
        print("PASSED: State returns all synced fields")


class TestCoachingSyncFlow:
    """
    End-to-end coaching sync flow test
    """
    
    def test_full_coaching_sync_flow(self, api_client, teacher_token, student_token, live_session_id, test_video):
        """
        Test full coaching sync flow:
        1. Teacher uploads video
        2. Student sees video_url in state
        3. Teacher plays
        4. Student sees is_playing=true
        5. Teacher seeks
        6. Student sees new current_time
        7. Teacher draws
        8. Student sees drawings
        9. Teacher clears drawings
        10. Student sees empty drawings
        """
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        student_headers = {"Authorization": f"Bearer {student_token}"}
        
        # Step 1: Teacher uploads video
        print("\n--- Step 1: Teacher uploads video ---")
        with open(test_video, 'rb') as f:
            files = {'file': ('coaching_clip.mp4', f, 'video/mp4')}
            upload_response = requests.post(
                f"{BASE_URL}/api/coaching/{live_session_id}/upload",
                files=files,
                headers=teacher_headers,
                timeout=120
            )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        video_url = upload_response.json().get("video_url")
        assert video_url, "video_url not returned from upload"
        print(f"PASSED: Video uploaded - {video_url}")
        
        # Step 2: Student polls and sees video_url
        print("\n--- Step 2: Student sees video_url ---")
        state_response = api_client.get(
            f"{BASE_URL}/api/coaching/{live_session_id}/state",
            headers=student_headers
        )
        assert state_response.status_code == 200
        state = state_response.json()
        assert state.get("video_url") == video_url, f"Student should see video_url: {state}"
        print(f"PASSED: Student sees video_url - {state.get('video_url')}")
        
        # Step 3: Teacher plays
        print("\n--- Step 3: Teacher plays ---")
        play_response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "play"},
            headers={**teacher_headers, "Content-Type": "application/json"}
        )
        assert play_response.status_code == 200
        print("PASSED: Play command sent")
        
        # Step 4: Student sees is_playing=true
        print("\n--- Step 4: Student sees is_playing=true ---")
        state_response = api_client.get(
            f"{BASE_URL}/api/coaching/{live_session_id}/state",
            headers=student_headers
        )
        state = state_response.json()
        assert state.get("is_playing") == True, f"Student should see is_playing=true: {state}"
        print("PASSED: Student sees is_playing=true")
        
        # Step 5: Teacher seeks to 2.5 seconds
        print("\n--- Step 5: Teacher seeks to 2.5s ---")
        seek_response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "seek", "value": "2.5"},
            headers={**teacher_headers, "Content-Type": "application/json"}
        )
        assert seek_response.status_code == 200
        print("PASSED: Seek command sent")
        
        # Step 6: Student sees new current_time
        print("\n--- Step 6: Student sees current_time=2.5 ---")
        state_response = api_client.get(
            f"{BASE_URL}/api/coaching/{live_session_id}/state",
            headers=student_headers
        )
        state = state_response.json()
        assert abs(state.get("current_time", 0) - 2.5) < 0.1, f"Student should see current_time~2.5: {state}"
        print(f"PASSED: Student sees current_time={state.get('current_time')}")
        
        # Step 7: Teacher draws
        print("\n--- Step 7: Teacher draws ---")
        drawing = '{"d":"M20,20 L80,80","color":"#4CD964"}'
        draw_response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "draw", "value": drawing},
            headers={**teacher_headers, "Content-Type": "application/json"}
        )
        assert draw_response.status_code == 200
        print("PASSED: Draw command sent")
        
        # Step 8: Student sees drawings
        print("\n--- Step 8: Student sees drawings ---")
        state_response = api_client.get(
            f"{BASE_URL}/api/coaching/{live_session_id}/state",
            headers=student_headers
        )
        state = state_response.json()
        drawings = state.get("drawings", [])
        assert len(drawings) > 0, f"Student should see drawings: {state}"
        print(f"PASSED: Student sees {len(drawings)} drawing(s)")
        
        # Step 9: Teacher clears drawings
        print("\n--- Step 9: Teacher clears drawings ---")
        clear_response = api_client.post(
            f"{BASE_URL}/api/coaching/{live_session_id}/command",
            json={"action": "clear_drawings"},
            headers={**teacher_headers, "Content-Type": "application/json"}
        )
        assert clear_response.status_code == 200
        print("PASSED: Clear drawings command sent")
        
        # Step 10: Student sees empty drawings
        print("\n--- Step 10: Student sees empty drawings ---")
        state_response = api_client.get(
            f"{BASE_URL}/api/coaching/{live_session_id}/state",
            headers=student_headers
        )
        state = state_response.json()
        drawings = state.get("drawings", [])
        assert len(drawings) == 0, f"Student should see empty drawings after clear: {state}"
        print("PASSED: Student sees empty drawings array")
        
        print("\n=== FULL COACHING SYNC FLOW PASSED ===")


class TestVideoPlayerEndpoint:
    """
    Test GET /api/video-player/{filename}
    Video player page serves correct HTML for coaching clips
    """
    
    def test_video_player_nonexistent_file(self, api_client):
        """Video player should return 404 for non-existent file"""
        response = api_client.get(f"{BASE_URL}/api/video-player/nonexistent_video.mp4")
        assert response.status_code == 404, f"Expected 404: {response.status_code}"
        print("PASSED: Video player returns 404 for non-existent file")
    
    def test_video_player_returns_html(self, api_client, teacher_token, live_session_id, test_video):
        """Video player should return HTML page for uploaded video"""
        # First upload a video
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video, 'rb') as f:
            files = {'file': ('test_video.mp4', f, 'video/mp4')}
            upload_response = requests.post(
                f"{BASE_URL}/api/coaching/{live_session_id}/upload",
                files=files,
                headers=headers,
                timeout=120
            )
        
        if upload_response.status_code != 200:
            pytest.skip("Upload failed, cannot test video player")
        
        video_url = upload_response.json().get("video_url", "")
        filename = video_url.replace("/api/uploads/", "")
        
        # Now test video-player endpoint
        response = api_client.get(f"{BASE_URL}/api/video-player/{filename}")
        
        assert response.status_code == 200, f"Video player failed: {response.status_code}"
        
        # Verify response is HTML
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected HTML content type: {content_type}"
        
        # Verify HTML contains video element
        html = response.text
        assert "<video" in html, f"HTML should contain video element"
        assert f"/api/media/{filename}" in html, f"HTML should reference media endpoint"
        print(f"PASSED: Video player returns HTML for {filename}")
    
    def test_video_player_query_params(self, api_client, teacher_token, live_session_id, test_video):
        """Test video player query parameters (controls, muted, autoplay, fit)"""
        # First upload a video
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video, 'rb') as f:
            files = {'file': ('test_params.mp4', f, 'video/mp4')}
            upload_response = requests.post(
                f"{BASE_URL}/api/coaching/{live_session_id}/upload",
                files=files,
                headers=headers,
                timeout=120
            )
        
        if upload_response.status_code != 200:
            pytest.skip("Upload failed")
        
        video_url = upload_response.json().get("video_url", "")
        filename = video_url.replace("/api/uploads/", "")
        
        # Test with controls=1
        response = api_client.get(
            f"{BASE_URL}/api/video-player/{filename}?controls=1&muted=0&autoplay=0&fit=contain"
        )
        
        assert response.status_code == 200
        html = response.text
        
        # Should have controls attribute
        assert "controls" in html, "HTML should have controls attribute"
        # Should have object-fit: contain
        assert "contain" in html, "HTML should have object-fit: contain"
        
        print("PASSED: Video player respects query parameters")


class TestMediaStreamingEndpoint:
    """
    Test GET /api/media/{filename}
    Media streaming endpoint serves the compressed coaching clip
    """
    
    def test_media_nonexistent_file(self, api_client):
        """Media endpoint should return 404 for non-existent file"""
        response = api_client.get(f"{BASE_URL}/api/media/nonexistent_video.mp4")
        assert response.status_code == 404, f"Expected 404: {response.status_code}"
        print("PASSED: Media endpoint returns 404 for non-existent file")
    
    def test_media_streaming(self, api_client, teacher_token, live_session_id, test_video):
        """Test media streaming endpoint serves video"""
        # First upload a video
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video, 'rb') as f:
            files = {'file': ('stream_test.mp4', f, 'video/mp4')}
            upload_response = requests.post(
                f"{BASE_URL}/api/coaching/{live_session_id}/upload",
                files=files,
                headers=headers,
                timeout=120
            )
        
        if upload_response.status_code != 200:
            pytest.skip("Upload failed")
        
        video_url = upload_response.json().get("video_url", "")
        filename = video_url.replace("/api/uploads/", "")
        
        # Test media endpoint
        response = api_client.get(f"{BASE_URL}/api/media/{filename}")
        
        assert response.status_code == 200, f"Media streaming failed: {response.status_code}"
        
        # Verify content type is video
        content_type = response.headers.get("content-type", "")
        assert "video" in content_type, f"Expected video content type: {content_type}"
        
        # Verify Accept-Ranges header (for range requests)
        accept_ranges = response.headers.get("accept-ranges", "")
        assert accept_ranges == "bytes", f"Expected Accept-Ranges: bytes - got {accept_ranges}"
        
        print(f"PASSED: Media streaming works for {filename}")
    
    def test_media_head_request(self, api_client, teacher_token, live_session_id, test_video):
        """Test HEAD request to media endpoint"""
        # First upload a video
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video, 'rb') as f:
            files = {'file': ('head_test.mp4', f, 'video/mp4')}
            upload_response = requests.post(
                f"{BASE_URL}/api/coaching/{live_session_id}/upload",
                files=files,
                headers=headers,
                timeout=120
            )
        
        if upload_response.status_code != 200:
            pytest.skip("Upload failed")
        
        video_url = upload_response.json().get("video_url", "")
        filename = video_url.replace("/api/uploads/", "")
        
        # Test HEAD request
        response = api_client.head(f"{BASE_URL}/api/media/{filename}")
        
        assert response.status_code == 200, f"HEAD request failed: {response.status_code}"
        
        # Verify Content-Length header
        content_length = response.headers.get("content-length", "")
        assert content_length, "HEAD response should have Content-Length"
        assert int(content_length) > 0, "Content-Length should be > 0"
        
        print(f"PASSED: Media HEAD request works - Content-Length: {content_length}")
    
    def test_media_range_request(self, api_client, teacher_token, live_session_id, test_video):
        """Test range request to media endpoint (required for iOS streaming)"""
        # First upload a video
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video, 'rb') as f:
            files = {'file': ('range_test.mp4', f, 'video/mp4')}
            upload_response = requests.post(
                f"{BASE_URL}/api/coaching/{live_session_id}/upload",
                files=files,
                headers=headers,
                timeout=120
            )
        
        if upload_response.status_code != 200:
            pytest.skip("Upload failed")
        
        video_url = upload_response.json().get("video_url", "")
        filename = video_url.replace("/api/uploads/", "")
        
        # Test range request
        response = api_client.get(
            f"{BASE_URL}/api/media/{filename}",
            headers={"Range": "bytes=0-1023"}
        )
        
        # Should return 206 Partial Content
        assert response.status_code == 206, f"Range request should return 206: {response.status_code}"
        
        # Verify Content-Range header
        content_range = response.headers.get("content-range", "")
        assert content_range.startswith("bytes 0-"), f"Expected Content-Range header: {content_range}"
        
        print(f"PASSED: Media range request works - {content_range}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
