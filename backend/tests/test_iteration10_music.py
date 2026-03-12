"""
Iteration 10 - Music Feature Tests
Tests for: 
- GET /api/music/genres - List dance genres
- POST /api/music/playlists - Create playlist
- GET /api/music/playlists - Get user's playlists
- DELETE /api/music/playlists/{id} - Delete playlist
- POST /api/music/songs/upload - Upload audio file
- GET /api/music/songs - List songs with filters
- POST /api/music/songs/{id}/like - Toggle like
- PUT /api/music/songs/{id}/playlist - Move song to playlist
- DELETE /api/music/songs/{id} - Delete song
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://rhythm-connect-14.preview.emergentagent.com')

class TestMusicFeature:
    """Music playlist and song management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as test user
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_get_genres(self):
        """Test GET /api/music/genres returns list of dance genres"""
        response = self.session.get(f"{BASE_URL}/api/music/genres")
        assert response.status_code == 200
        
        genres = response.json()
        assert isinstance(genres, list)
        assert len(genres) > 0
        assert "ALL" in genres
        assert "SAMBA" in genres
        assert "TANGO" in genres
        assert "LATIN" in genres
        print(f"✓ Genres returned: {genres}")
    
    def test_create_playlist(self):
        """Test POST /api/music/playlists creates a playlist"""
        response = self.session.post(f"{BASE_URL}/api/music/playlists", json={
            "name": "TEST_My Dance Playlist",
            "genre": "LATIN"
        })
        assert response.status_code == 200
        
        playlist = response.json()
        assert "id" in playlist
        assert playlist["name"] == "TEST_My Dance Playlist"
        assert playlist["genre"] == "LATIN"
        assert playlist["song_count"] == 0
        print(f"✓ Playlist created: {playlist['id']}")
        
        # Store for cleanup
        self.created_playlist_id = playlist["id"]
        
        # Verify by fetching playlists
        response = self.session.get(f"{BASE_URL}/api/music/playlists")
        assert response.status_code == 200
        playlists = response.json()
        found = any(p["id"] == self.created_playlist_id for p in playlists)
        assert found, "Created playlist not found in list"
        print(f"✓ Playlist verified in list")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/music/playlists/{self.created_playlist_id}")
    
    def test_get_playlists(self):
        """Test GET /api/music/playlists returns user's playlists"""
        response = self.session.get(f"{BASE_URL}/api/music/playlists")
        assert response.status_code == 200
        
        playlists = response.json()
        assert isinstance(playlists, list)
        for p in playlists:
            assert "id" in p
            assert "name" in p
            assert "genre" in p
            assert "song_count" in p
        print(f"✓ Retrieved {len(playlists)} playlists")
    
    def test_delete_playlist(self):
        """Test DELETE /api/music/playlists/{id} deletes a playlist"""
        # First create a playlist
        response = self.session.post(f"{BASE_URL}/api/music/playlists", json={
            "name": "TEST_Playlist to Delete",
            "genre": "JAZZ"
        })
        assert response.status_code == 200
        playlist_id = response.json()["id"]
        print(f"✓ Created playlist for deletion: {playlist_id}")
        
        # Delete it
        response = self.session.delete(f"{BASE_URL}/api/music/playlists/{playlist_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"
        print(f"✓ Playlist deleted")
        
        # Verify deletion
        response = self.session.get(f"{BASE_URL}/api/music/playlists")
        playlists = response.json()
        found = any(p["id"] == playlist_id for p in playlists)
        assert not found, "Deleted playlist still in list"
        print(f"✓ Deletion verified")
    
    def test_upload_song(self):
        """Test POST /api/music/songs/upload uploads an audio file"""
        # Create a small test audio file (silent WAV)
        import wave
        import struct
        import tempfile
        import os as _os
        
        # Create minimal WAV file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            wav_path = f.name
            wav_file = wave.open(f, 'w')
            wav_file.setparams((1, 2, 44100, 44100, 'NONE', 'not compressed'))
            for _ in range(44100):  # 1 second of silence
                packed_value = struct.pack('h', 0)
                wav_file.writeframesraw(packed_value)
            wav_file.close()
        
        try:
            # Upload the file
            with open(wav_path, 'rb') as audio_file:
                files = {'file': ('test_song.wav', audio_file, 'audio/wav')}
                data = {
                    'title': 'TEST_Test Dance Track',
                    'artist': 'Test Artist',
                    'genre': 'LATIN'
                }
                # Remove Content-Type header for multipart upload
                headers = {"Authorization": f"Bearer {self.token}"}
                response = requests.post(
                    f"{BASE_URL}/api/music/songs/upload",
                    files=files,
                    data=data,
                    headers=headers
                )
            
            assert response.status_code == 200, f"Upload failed: {response.text}"
            song = response.json()
            assert "id" in song
            assert song["title"] == "TEST_Test Dance Track"
            assert song["artist"] == "Test Artist"
            assert song["genre"] == "LATIN"
            assert "file_url" in song
            print(f"✓ Song uploaded: {song['id']}")
            
            # Store for later tests
            self.uploaded_song_id = song["id"]
            
            # Verify in song list
            response = self.session.get(f"{BASE_URL}/api/music/songs")
            songs = response.json()
            found = any(s["id"] == self.uploaded_song_id for s in songs)
            assert found, "Uploaded song not found in list"
            print(f"✓ Song verified in list")
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/music/songs/{self.uploaded_song_id}")
        finally:
            _os.unlink(wav_path)
    
    def test_get_songs(self):
        """Test GET /api/music/songs returns songs with filters"""
        response = self.session.get(f"{BASE_URL}/api/music/songs")
        assert response.status_code == 200
        
        songs = response.json()
        assert isinstance(songs, list)
        for s in songs:
            assert "id" in s
            assert "title" in s
            assert "artist" in s
            assert "genre" in s
            assert "file_url" in s
            assert "is_liked" in s
        print(f"✓ Retrieved {len(songs)} songs")
        
        # Test genre filter
        response = self.session.get(f"{BASE_URL}/api/music/songs", params={"genre": "LATIN"})
        assert response.status_code == 200
        print(f"✓ Genre filter works")
        
        # Test liked_only filter
        response = self.session.get(f"{BASE_URL}/api/music/songs", params={"liked_only": True})
        assert response.status_code == 200
        print(f"✓ Liked filter works")
    
    def test_toggle_song_like(self):
        """Test POST /api/music/songs/{id}/like toggles like"""
        # First create and upload a song
        import wave
        import struct
        import tempfile
        import os as _os
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            wav_path = f.name
            wav_file = wave.open(f, 'w')
            wav_file.setparams((1, 2, 44100, 44100, 'NONE', 'not compressed'))
            for _ in range(44100):
                wav_file.writeframesraw(struct.pack('h', 0))
            wav_file.close()
        
        try:
            with open(wav_path, 'rb') as audio_file:
                files = {'file': ('like_test.wav', audio_file, 'audio/wav')}
                data = {'title': 'TEST_Like Test Song', 'artist': 'Test', 'genre': 'JAZZ'}
                headers = {"Authorization": f"Bearer {self.token}"}
                response = requests.post(f"{BASE_URL}/api/music/songs/upload", files=files, data=data, headers=headers)
            
            assert response.status_code == 200
            song_id = response.json()["id"]
            print(f"✓ Created song for like test: {song_id}")
            
            # Like the song
            response = self.session.post(f"{BASE_URL}/api/music/songs/{song_id}/like")
            assert response.status_code == 200
            assert response.json()["liked"] == True
            print(f"✓ Song liked")
            
            # Unlike the song
            response = self.session.post(f"{BASE_URL}/api/music/songs/{song_id}/like")
            assert response.status_code == 200
            assert response.json()["liked"] == False
            print(f"✓ Song unliked")
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/music/songs/{song_id}")
        finally:
            _os.unlink(wav_path)
    
    def test_move_song_to_playlist(self):
        """Test PUT /api/music/songs/{id}/playlist moves song to playlist"""
        import wave
        import struct
        import tempfile
        import os as _os
        
        # Create playlist
        response = self.session.post(f"{BASE_URL}/api/music/playlists", json={
            "name": "TEST_Playlist for Move",
            "genre": "SAMBA"
        })
        assert response.status_code == 200
        playlist_id = response.json()["id"]
        print(f"✓ Created playlist: {playlist_id}")
        
        # Create song
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            wav_path = f.name
            wav_file = wave.open(f, 'w')
            wav_file.setparams((1, 2, 44100, 44100, 'NONE', 'not compressed'))
            for _ in range(44100):
                wav_file.writeframesraw(struct.pack('h', 0))
            wav_file.close()
        
        try:
            with open(wav_path, 'rb') as audio_file:
                files = {'file': ('move_test.wav', audio_file, 'audio/wav')}
                data = {'title': 'TEST_Move Test Song', 'artist': 'Test', 'genre': 'SAMBA'}
                headers = {"Authorization": f"Bearer {self.token}"}
                response = requests.post(f"{BASE_URL}/api/music/songs/upload", files=files, data=data, headers=headers)
            
            assert response.status_code == 200
            song_id = response.json()["id"]
            print(f"✓ Created song: {song_id}")
            
            # Move song to playlist
            response = self.session.put(
                f"{BASE_URL}/api/music/songs/{song_id}/playlist",
                params={"playlist_id": playlist_id}
            )
            assert response.status_code == 200
            assert response.json()["status"] == "updated"
            print(f"✓ Song moved to playlist")
            
            # Verify in song list
            response = self.session.get(f"{BASE_URL}/api/music/songs")
            songs = response.json()
            song = next((s for s in songs if s["id"] == song_id), None)
            assert song is not None
            assert song["playlist_id"] == playlist_id
            print(f"✓ Playlist assignment verified")
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/music/songs/{song_id}")
            self.session.delete(f"{BASE_URL}/api/music/playlists/{playlist_id}")
        finally:
            _os.unlink(wav_path)
    
    def test_delete_song(self):
        """Test DELETE /api/music/songs/{id} deletes a song"""
        import wave
        import struct
        import tempfile
        import os as _os
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            wav_path = f.name
            wav_file = wave.open(f, 'w')
            wav_file.setparams((1, 2, 44100, 44100, 'NONE', 'not compressed'))
            for _ in range(44100):
                wav_file.writeframesraw(struct.pack('h', 0))
            wav_file.close()
        
        try:
            with open(wav_path, 'rb') as audio_file:
                files = {'file': ('delete_test.wav', audio_file, 'audio/wav')}
                data = {'title': 'TEST_Delete Test Song', 'artist': 'Test', 'genre': 'TANGO'}
                headers = {"Authorization": f"Bearer {self.token}"}
                response = requests.post(f"{BASE_URL}/api/music/songs/upload", files=files, data=data, headers=headers)
            
            assert response.status_code == 200
            song_id = response.json()["id"]
            print(f"✓ Created song for deletion: {song_id}")
            
            # Delete song
            response = self.session.delete(f"{BASE_URL}/api/music/songs/{song_id}")
            assert response.status_code == 200
            assert response.json()["status"] == "deleted"
            print(f"✓ Song deleted")
            
            # Verify deletion
            response = self.session.get(f"{BASE_URL}/api/music/songs")
            songs = response.json()
            found = any(s["id"] == song_id for s in songs)
            assert not found, "Deleted song still in list"
            print(f"✓ Deletion verified")
        finally:
            _os.unlink(wav_path)


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_login(self):
        """Test login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "mario@test.com",
            "password": "password123"
        })
        assert response.status_code == 200
        assert "access_token" in response.json()
        print("✓ Login works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
