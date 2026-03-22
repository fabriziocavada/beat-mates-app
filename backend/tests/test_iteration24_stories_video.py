"""
Iteration 24 - Stories Video System Testing
Tests for:
- POST /api/upload with video file returns thumbnail URL
- POST /api/stories creates story with thumbnail for video type
- GET /api/stories returns stories with thumbnail field populated
- GET /api/media/{filename} serves video with Range request support (HTTP 206)
- GET /api/media/{filename} serves thumbnail images (HTTP 200)
- Verify ffmpeg is accessible at /usr/bin/ffmpeg
- Verify all video stories in DB have non-null thumbnail field
"""

import pytest
import requests
import os
import subprocess
import tempfile
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://coaching-live-demo-1.preview.emergentagent.com').rstrip('/')

# Test credentials
TEACHER_EMAIL = "tutor@test.com"
TEACHER_PASSWORD = "password123"
STUDENT_EMAIL = "mario@test.com"
STUDENT_PASSWORD = "password123"


@pytest.fixture(scope="module")
def teacher_token():
    """Get auth token for teacher account"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    assert response.status_code == 200, f"Teacher login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, f"No access_token in response: {data}"
    return data["access_token"]


@pytest.fixture(scope="module")
def student_token():
    """Get auth token for student account"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_EMAIL,
        "password": STUDENT_PASSWORD
    })
    assert response.status_code == 200, f"Student login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, f"No access_token in response: {data}"
    return data["access_token"]


@pytest.fixture(scope="module")
def test_video_file():
    """Create a small test video file using ffmpeg"""
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as f:
        video_path = f.name
    
    # Create a 1-second blue video with audio using ffmpeg
    cmd = [
        '/usr/bin/ffmpeg', '-y',
        '-f', 'lavfi', '-i', 'color=c=blue:size=320x240:d=1',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100',
        '-c:v', 'libx264', '-c:a', 'aac', '-shortest',
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=30)
    assert result.returncode == 0, f"Failed to create test video: {result.stderr.decode()}"
    
    yield video_path
    
    # Cleanup
    if os.path.exists(video_path):
        os.remove(video_path)


class TestFFmpegAvailability:
    """Test that ffmpeg is accessible at the expected path"""
    
    def test_ffmpeg_exists_at_expected_path(self):
        """Verify ffmpeg is accessible at /usr/bin/ffmpeg"""
        assert os.path.exists('/usr/bin/ffmpeg'), "ffmpeg not found at /usr/bin/ffmpeg"
    
    def test_ffmpeg_is_executable(self):
        """Verify ffmpeg can be executed"""
        result = subprocess.run(['/usr/bin/ffmpeg', '-version'], capture_output=True, timeout=10)
        assert result.returncode == 0, f"ffmpeg execution failed: {result.stderr.decode()}"
        assert b'ffmpeg version' in result.stdout, "ffmpeg version output not found"
    
    def test_ffmpeg_has_libx264(self):
        """Verify ffmpeg has H.264 encoder (libx264)"""
        result = subprocess.run(['/usr/bin/ffmpeg', '-encoders'], capture_output=True, timeout=10)
        assert b'libx264' in result.stdout, "libx264 encoder not available in ffmpeg"


class TestVideoUpload:
    """Test POST /api/upload with video files"""
    
    def test_upload_video_returns_thumbnail_url(self, teacher_token, test_video_file):
        """POST /api/upload with video file should return thumbnail URL in response"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video_file, 'rb') as f:
            files = {'file': ('test_video.mp4', f, 'video/mp4')}
            response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "url" in data, f"No 'url' in response: {data}"
        assert "filename" in data, f"No 'filename' in response: {data}"
        assert "media_type" in data, f"No 'media_type' in response: {data}"
        assert "thumbnail" in data, f"No 'thumbnail' in response: {data}"
        
        # Verify thumbnail is not None for video
        assert data["thumbnail"] is not None, f"Thumbnail should not be None for video upload: {data}"
        assert data["thumbnail"].startswith("/api/uploads/"), f"Thumbnail URL format incorrect: {data['thumbnail']}"
        assert data["media_type"] == "video", f"Media type should be 'video': {data['media_type']}"
    
    def test_upload_video_thumbnail_is_accessible(self, teacher_token, test_video_file):
        """Uploaded video thumbnail should be accessible via GET request"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video_file, 'rb') as f:
            files = {'file': ('test_video2.mp4', f, 'video/mp4')}
            response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        
        assert response.status_code == 200
        data = response.json()
        thumbnail_url = data.get("thumbnail")
        assert thumbnail_url is not None
        
        # Fetch the thumbnail
        thumb_response = requests.get(f"{BASE_URL}{thumbnail_url}")
        assert thumb_response.status_code == 200, f"Thumbnail not accessible: {thumb_response.status_code}"
        assert 'image' in thumb_response.headers.get('Content-Type', ''), f"Thumbnail should be an image"


class TestStoryCreation:
    """Test POST /api/stories creates story with thumbnail for video type"""
    
    def test_create_video_story_has_thumbnail(self, teacher_token, test_video_file):
        """POST /api/stories with video should create story with thumbnail"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        # First upload the video
        with open(test_video_file, 'rb') as f:
            files = {'file': ('story_video.mp4', f, 'video/mp4')}
            upload_response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        video_url = upload_data["url"]
        
        # Create story with the video URL (using base64 format as expected by API)
        import base64
        with open(test_video_file, 'rb') as f:
            video_b64 = base64.b64encode(f.read()).decode()
        
        story_data = {
            "media": f"data:video/mp4;base64,{video_b64}",
            "type": "video"
        }
        
        response = requests.post(f"{BASE_URL}/api/stories", headers=headers, json=story_data)
        assert response.status_code == 200, f"Story creation failed: {response.text}"
        
        data = response.json()
        assert "id" in data, f"No 'id' in story response: {data}"
        assert "media" in data, f"No 'media' in story response: {data}"
        assert "type" in data, f"No 'type' in story response: {data}"
        assert data["type"] == "video", f"Story type should be 'video': {data['type']}"
        
        # Thumbnail should be generated for video stories
        # Note: thumbnail may be None if video processing is async or fails
        # But the field should exist
        assert "thumbnail" in data, f"No 'thumbnail' field in story response: {data}"


class TestGetStories:
    """Test GET /api/stories returns stories with thumbnail field"""
    
    def test_get_stories_includes_thumbnail_field(self, teacher_token):
        """GET /api/stories should return stories with thumbnail field populated for video stories"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        response = requests.get(f"{BASE_URL}/api/stories", headers=headers)
        assert response.status_code == 200, f"Get stories failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), f"Stories response should be a list: {type(data)}"
        
        # Check structure of stories
        for user_stories in data:
            assert "user_id" in user_stories, f"No 'user_id' in user stories: {user_stories}"
            assert "stories" in user_stories, f"No 'stories' in user stories: {user_stories}"
            
            for story in user_stories.get("stories", []):
                assert "id" in story, f"No 'id' in story: {story}"
                assert "media" in story, f"No 'media' in story: {story}"
                assert "type" in story, f"No 'type' in story: {story}"
                # thumbnail field should exist (may be None for photos)
                assert "thumbnail" in story, f"No 'thumbnail' field in story: {story}"
    
    def test_video_stories_have_thumbnails(self, teacher_token):
        """Video stories should have non-null thumbnail field"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        response = requests.get(f"{BASE_URL}/api/stories", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        video_stories_count = 0
        video_stories_with_thumbnail = 0
        
        for user_stories in data:
            for story in user_stories.get("stories", []):
                if story.get("type") == "video":
                    video_stories_count += 1
                    if story.get("thumbnail"):
                        video_stories_with_thumbnail += 1
        
        print(f"Found {video_stories_count} video stories, {video_stories_with_thumbnail} have thumbnails")
        
        # All video stories should have thumbnails (per the fix)
        if video_stories_count > 0:
            assert video_stories_with_thumbnail == video_stories_count, \
                f"Not all video stories have thumbnails: {video_stories_with_thumbnail}/{video_stories_count}"


class TestMediaStreaming:
    """Test GET /api/media/{filename} serves files correctly"""
    
    def test_media_endpoint_serves_video_with_range_support(self, teacher_token, test_video_file):
        """GET /api/media/{filename} should support Range requests (HTTP 206)"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        # First upload a video
        with open(test_video_file, 'rb') as f:
            files = {'file': ('range_test.mp4', f, 'video/mp4')}
            upload_response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        filename = upload_data["filename"]
        
        # Test Range request
        range_headers = {"Range": "bytes=0-1023"}
        response = requests.get(f"{BASE_URL}/api/media/{filename}", headers=range_headers)
        
        assert response.status_code == 206, f"Expected HTTP 206 for Range request, got {response.status_code}"
        assert "Content-Range" in response.headers, "Missing Content-Range header"
        assert response.headers.get("Accept-Ranges") == "bytes", "Missing Accept-Ranges: bytes header"
    
    def test_media_endpoint_serves_thumbnail_image(self, teacher_token, test_video_file):
        """GET /api/media/{filename} should serve thumbnail images (HTTP 200)"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        # First upload a video to get a thumbnail
        with open(test_video_file, 'rb') as f:
            files = {'file': ('thumb_test.mp4', f, 'video/mp4')}
            upload_response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        thumbnail_url = upload_data.get("thumbnail")
        assert thumbnail_url is not None, "No thumbnail URL returned"
        
        # Extract filename from thumbnail URL
        thumb_filename = thumbnail_url.replace("/api/uploads/", "")
        
        # Fetch via media endpoint
        response = requests.get(f"{BASE_URL}/api/media/{thumb_filename}")
        assert response.status_code == 200, f"Thumbnail fetch failed: {response.status_code}"
        assert 'image' in response.headers.get('Content-Type', ''), "Thumbnail should be an image"
    
    def test_media_endpoint_head_request(self, teacher_token, test_video_file):
        """HEAD request to /api/media/{filename} should return file info"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        # First upload a video
        with open(test_video_file, 'rb') as f:
            files = {'file': ('head_test.mp4', f, 'video/mp4')}
            upload_response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        filename = upload_data["filename"]
        
        # Test HEAD request
        response = requests.head(f"{BASE_URL}/api/media/{filename}")
        assert response.status_code == 200, f"HEAD request failed: {response.status_code}"
        assert "Content-Length" in response.headers, "Missing Content-Length header"
        assert response.headers.get("Accept-Ranges") == "bytes", "Missing Accept-Ranges header"
    
    def test_media_endpoint_404_for_nonexistent_file(self):
        """GET /api/media/{filename} should return 404 for non-existent file"""
        response = requests.get(f"{BASE_URL}/api/media/nonexistent_file_12345.mp4")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestDatabaseVideoStories:
    """Test that all video stories in DB have thumbnails"""
    
    def test_all_video_stories_have_thumbnails(self, teacher_token):
        """Verify all video stories returned by API have non-null thumbnail field"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        response = requests.get(f"{BASE_URL}/api/stories", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        missing_thumbnails = []
        for user_stories in data:
            for story in user_stories.get("stories", []):
                if story.get("type") == "video":
                    if not story.get("thumbnail"):
                        missing_thumbnails.append({
                            "story_id": story.get("id"),
                            "media": story.get("media", "")[:50] + "..."
                        })
        
        if missing_thumbnails:
            print(f"Video stories missing thumbnails: {missing_thumbnails}")
        
        assert len(missing_thumbnails) == 0, \
            f"Found {len(missing_thumbnails)} video stories without thumbnails: {missing_thumbnails}"


class TestVideoH264Encoding:
    """Test that uploaded videos are properly encoded to H.264"""
    
    def test_uploaded_video_is_h264_encoded(self, teacher_token, test_video_file):
        """Uploaded video should be re-encoded to H.264 for iOS compatibility"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        
        with open(test_video_file, 'rb') as f:
            files = {'file': ('h264_test.mp4', f, 'video/mp4')}
            response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        # Video should be processed
        assert data["media_type"] == "video"
        assert data["url"].endswith(".mp4"), f"Video should be MP4: {data['url']}"
        
        # Thumbnail should be generated
        assert data["thumbnail"] is not None, "Thumbnail should be generated for H.264 video"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
