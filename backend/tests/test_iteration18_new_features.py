"""
Test Iteration 18 - Beat Mates New Features
============================================
Testing new endpoints for:
1. POST /api/live-sessions/{session_id}/review - Review post-videochiamata (1-5 stelle)
2. GET /api/purchases/check/{lesson_id} - Verifica acquisto lezione
3. POST /api/purchases/mock - Mock acquisto lezione (Stripe mockup)
4. GET /api/music/playlists/premium - Lista playlist premium
5. POST /api/music/playlists/{playlist_id}/subscribe - Abbonamento playlist premium
6. GET /api/music/playlists/{playlist_id}/subscription - Verifica sottoscrizione

Credentials:
- Student: mario@test.com / password123
- Teacher: tutor@test.com / password123
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://stories-feed-staging.preview.emergentagent.com"

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
def student_client(api_client, student_token):
    """Session with student auth"""
    api_client.headers.update({"Authorization": f"Bearer {student_token}"})
    return api_client


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


class TestLiveSessionReview:
    """
    Test POST /api/live-sessions/{session_id}/review
    Recensione post-videochiamata con rating 1-5 stelle e commento opzionale
    """
    
    def test_review_requires_valid_session(self, api_client, student_token):
        """Review should fail for non-existent session"""
        headers = {"Authorization": f"Bearer {student_token}"}
        fake_session_id = str(uuid.uuid4())
        response = api_client.post(
            f"{BASE_URL}/api/live-sessions/{fake_session_id}/review",
            json={"rating": 5, "text": "Great!"},
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404 for non-existent session: {response.text}"
        print("PASSED: Review requires valid session")
    
    def test_review_requires_auth(self, api_client):
        """Review should fail without auth"""
        fake_session_id = str(uuid.uuid4())
        response = api_client.post(
            f"{BASE_URL}/api/live-sessions/{fake_session_id}/review",
            json={"rating": 5, "text": "Great!"}
        )
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected auth error: {response.text}"
        print("PASSED: Review requires authentication")
    
    def test_review_endpoint_exists(self, api_client, student_token):
        """Test that review endpoint exists and returns proper error for invalid input"""
        headers = {"Authorization": f"Bearer {student_token}"}
        # Try with empty body - should return validation error (422) or 404 for session
        response = api_client.post(
            f"{BASE_URL}/api/live-sessions/test-session/review",
            json={},
            headers=headers
        )
        # Should either return 404 (session not found) or 422 (validation error)
        assert response.status_code in [404, 422], f"Unexpected status: {response.status_code}"
        print("PASSED: Review endpoint exists")


class TestPurchaseCheck:
    """
    Test GET /api/purchases/check/{lesson_id}
    Verifica acquisto lezione
    """
    
    def test_purchase_check_requires_auth(self, api_client):
        """Purchase check should require authentication"""
        fake_lesson_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/purchases/check/{fake_lesson_id}")
        assert response.status_code in [401, 403], f"Expected auth error: {response.text}"
        print("PASSED: Purchase check requires auth")
    
    def test_purchase_check_not_purchased(self, api_client, student_token):
        """Check that a random lesson shows as not purchased"""
        headers = {"Authorization": f"Bearer {student_token}"}
        fake_lesson_id = str(uuid.uuid4())
        response = api_client.get(
            f"{BASE_URL}/api/purchases/check/{fake_lesson_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Purchase check failed: {response.text}"
        data = response.json()
        assert "purchased" in data
        assert data["purchased"] == False, "Random lesson should not be purchased"
        print("PASSED: Purchase check returns purchased=false for non-purchased lesson")


class TestMockPurchase:
    """
    Test POST /api/purchases/mock
    Mock acquisto lezione (Stripe non integrato - MOCKED API)
    """
    
    def test_mock_purchase_requires_auth(self, api_client):
        """Mock purchase should require auth"""
        response = api_client.post(
            f"{BASE_URL}/api/purchases/mock",
            json={"lesson_id": str(uuid.uuid4())}
        )
        assert response.status_code in [401, 403], f"Expected auth error: {response.text}"
        print("PASSED: Mock purchase requires auth")
    
    def test_mock_purchase_creates_record(self, api_client, student_token):
        """Test that mock purchase creates a purchase record"""
        headers = {"Authorization": f"Bearer {student_token}"}
        test_lesson_id = f"TEST_lesson_{uuid.uuid4().hex[:8]}"
        
        # First verify not purchased
        check_response = api_client.get(
            f"{BASE_URL}/api/purchases/check/{test_lesson_id}",
            headers=headers
        )
        assert check_response.status_code == 200
        assert check_response.json().get("purchased") == False
        
        # Mock purchase
        response = api_client.post(
            f"{BASE_URL}/api/purchases/mock",
            json={"lesson_id": test_lesson_id},
            headers=headers
        )
        assert response.status_code == 200, f"Mock purchase failed: {response.text}"
        data = response.json()
        assert "id" in data or "message" in data
        print(f"PASSED: Mock purchase created - {data}")
        
        # Verify purchase now shows as purchased
        verify_response = api_client.get(
            f"{BASE_URL}/api/purchases/check/{test_lesson_id}",
            headers=headers
        )
        assert verify_response.status_code == 200
        assert verify_response.json().get("purchased") == True, "Purchase should show as purchased after mock"
        print("PASSED: Purchase verification after mock - purchased=true")
    
    def test_mock_purchase_idempotent(self, api_client, student_token):
        """Test that duplicate mock purchase returns 'Already purchased'"""
        headers = {"Authorization": f"Bearer {student_token}"}
        test_lesson_id = f"TEST_lesson_{uuid.uuid4().hex[:8]}"
        
        # First purchase
        response1 = api_client.post(
            f"{BASE_URL}/api/purchases/mock",
            json={"lesson_id": test_lesson_id},
            headers=headers
        )
        assert response1.status_code == 200
        
        # Second purchase - should indicate already purchased
        response2 = api_client.post(
            f"{BASE_URL}/api/purchases/mock",
            json={"lesson_id": test_lesson_id},
            headers=headers
        )
        assert response2.status_code == 200, f"Second purchase failed: {response2.text}"
        data = response2.json()
        assert "Already purchased" in data.get("message", "") or "id" in data
        print("PASSED: Mock purchase is idempotent")


class TestPremiumPlaylists:
    """
    Test GET /api/music/playlists/premium
    Lista playlist premium con tracce demo
    """
    
    def test_premium_playlists_requires_auth(self, api_client):
        """Premium playlists should require auth"""
        response = api_client.get(f"{BASE_URL}/api/music/playlists/premium")
        assert response.status_code in [401, 403], f"Expected auth error: {response.text}"
        print("PASSED: Premium playlists requires auth")
    
    def test_premium_playlists_returns_list(self, api_client, student_token):
        """Test that premium playlists endpoint returns a list"""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = api_client.get(
            f"{BASE_URL}/api/music/playlists/premium",
            headers=headers
        )
        assert response.status_code == 200, f"Premium playlists failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Premium playlists should return a list"
        print(f"PASSED: Premium playlists returns list - {len(data)} playlists found")
        
        # If any playlists exist, verify structure
        if len(data) > 0:
            playlist = data[0]
            # Check expected fields
            assert "id" in playlist, "Playlist should have id"
            assert "name" in playlist, "Playlist should have name"
            # is_subscribed field should exist for user context
            if "is_subscribed" in playlist:
                assert isinstance(playlist["is_subscribed"], bool)
            print(f"PASSED: Premium playlist structure verified - {playlist.get('name', 'N/A')}")


class TestPlaylistSubscription:
    """
    Test POST /api/music/playlists/{playlist_id}/subscribe
    Abbonamento playlist premium (MOCKED - $10/month not actually charged)
    """
    
    def test_subscribe_requires_auth(self, api_client):
        """Subscribe should require auth"""
        fake_playlist_id = str(uuid.uuid4())
        response = api_client.post(f"{BASE_URL}/api/music/playlists/{fake_playlist_id}/subscribe")
        assert response.status_code in [401, 403], f"Expected auth error: {response.text}"
        print("PASSED: Subscribe requires auth")
    
    def test_subscribe_requires_valid_playlist(self, api_client, student_token):
        """Subscribe should fail for non-existent playlist"""
        headers = {"Authorization": f"Bearer {student_token}"}
        fake_playlist_id = str(uuid.uuid4())
        response = api_client.post(
            f"{BASE_URL}/api/music/playlists/{fake_playlist_id}/subscribe",
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404 for non-existent playlist: {response.text}"
        print("PASSED: Subscribe requires valid playlist")


class TestSubscriptionCheck:
    """
    Test GET /api/music/playlists/{playlist_id}/subscription
    Verifica sottoscrizione
    """
    
    def test_subscription_check_requires_auth(self, api_client):
        """Subscription check should require auth"""
        fake_playlist_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/music/playlists/{fake_playlist_id}/subscription")
        assert response.status_code in [401, 403], f"Expected auth error: {response.text}"
        print("PASSED: Subscription check requires auth")
    
    def test_subscription_check_returns_status(self, api_client, student_token):
        """Subscription check should return subscribed status"""
        headers = {"Authorization": f"Bearer {student_token}"}
        # First check that user is not subscribed to a random playlist
        fake_playlist_id = str(uuid.uuid4())
        response = api_client.get(
            f"{BASE_URL}/api/music/playlists/{fake_playlist_id}/subscription",
            headers=headers
        )
        # This will likely return 200 with subscribed=false (not 404 since it just checks DB)
        assert response.status_code == 200, f"Subscription check failed: {response.text}"
        data = response.json()
        assert "subscribed" in data
        assert data["subscribed"] == False, "Should not be subscribed to random playlist"
        print("PASSED: Subscription check returns subscribed=false for non-subscribed")


class TestEndToEndPremiumFlow:
    """
    End-to-end test: Create premium playlist, subscribe, verify
    """
    
    def test_premium_playlist_full_flow(self, api_client, teacher_token, student_token):
        """Test full premium playlist subscription flow"""
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        student_headers = {"Authorization": f"Bearer {student_token}"}
        test_playlist_name = f"TEST_Premium_{uuid.uuid4().hex[:6]}"
        created_playlist_id = None
        
        try:
            # Step 1: Teacher creates a premium playlist
            create_response = api_client.post(
                f"{BASE_URL}/api/music/playlists",
                json={
                    "name": test_playlist_name,
                    "genre": "LATIN",
                    "is_premium": True,
                    "price_monthly": 10.0
                },
                headers=teacher_headers
            )
            assert create_response.status_code == 200, f"Create playlist failed: {create_response.text}"
            playlist_data = create_response.json()
            created_playlist_id = playlist_data.get("id")
            assert created_playlist_id, "Playlist ID not returned"
            print(f"PASSED: Created premium playlist - ID: {created_playlist_id}")
            
            # Step 2: Verify it appears in premium playlists
            list_response = api_client.get(
                f"{BASE_URL}/api/music/playlists/premium",
                headers=student_headers
            )
            assert list_response.status_code == 200
            premium_list = list_response.json()
            found_playlist = next((p for p in premium_list if p.get("id") == created_playlist_id), None)
            assert found_playlist, "Created playlist not found in premium list"
            print(f"PASSED: Playlist appears in premium list")
            
            # Step 3: Check subscription status (should be false)
            sub_check_response = api_client.get(
                f"{BASE_URL}/api/music/playlists/{created_playlist_id}/subscription",
                headers=student_headers
            )
            assert sub_check_response.status_code == 200
            assert sub_check_response.json().get("subscribed") == False
            print("PASSED: Initial subscription status is false")
            
            # Step 4: Subscribe (MOCKED)
            subscribe_response = api_client.post(
                f"{BASE_URL}/api/music/playlists/{created_playlist_id}/subscribe",
                headers=student_headers
            )
            assert subscribe_response.status_code == 200, f"Subscribe failed: {subscribe_response.text}"
            print(f"PASSED: Subscription created (MOCKED) - {subscribe_response.json()}")
            
            # Step 5: Verify subscription status
            verify_response = api_client.get(
                f"{BASE_URL}/api/music/playlists/{created_playlist_id}/subscription",
                headers=student_headers
            )
            assert verify_response.status_code == 200
            assert verify_response.json().get("subscribed") == True, "Should be subscribed after subscribe"
            print("PASSED: Subscription verified - subscribed=true")
            
            # Step 6: Try subscribe again (should be idempotent)
            resub_response = api_client.post(
                f"{BASE_URL}/api/music/playlists/{created_playlist_id}/subscribe",
                headers=student_headers
            )
            assert resub_response.status_code == 200
            assert "Already subscribed" in resub_response.json().get("message", "")
            print("PASSED: Re-subscribe is idempotent")
            
        finally:
            # Cleanup: Delete the test playlist
            if created_playlist_id:
                api_client.delete(
                    f"{BASE_URL}/api/music/playlists/{created_playlist_id}",
                    headers=teacher_headers
                )
                print(f"CLEANUP: Deleted test playlist {created_playlist_id}")


class TestEndToEndLiveSessionReview:
    """
    End-to-end test: Create live session, complete it, then review
    """
    
    def test_live_session_review_flow(self, api_client, teacher_token, student_token, teacher_data, student_data):
        """Test full live session review flow"""
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        student_headers = {"Authorization": f"Bearer {student_token}"}
        
        if not teacher_data or not student_data:
            pytest.skip("Missing user data")
        
        teacher_id = teacher_data.get("id")
        created_session_id = None
        
        try:
            # Step 1: Enable teacher availability
            toggle_response = api_client.post(
                f"{BASE_URL}/api/users/me/toggle-availability",
                headers=teacher_headers
            )
            # Just continue even if already available
            
            # Step 2: Student requests live session with teacher
            request_response = api_client.post(
                f"{BASE_URL}/api/live-sessions/request",
                json={"teacher_id": teacher_id},
                headers=student_headers
            )
            
            if request_response.status_code != 200:
                # Teacher might not be available, try to make them available first
                api_client.post(f"{BASE_URL}/api/users/me/toggle-availability", headers=teacher_headers)
                request_response = api_client.post(
                    f"{BASE_URL}/api/live-sessions/request",
                    json={"teacher_id": teacher_id},
                    headers=student_headers
                )
            
            assert request_response.status_code == 200, f"Request session failed: {request_response.text}"
            session_data = request_response.json()
            created_session_id = session_data.get("id")
            assert created_session_id, "Session ID not returned"
            print(f"PASSED: Created live session - ID: {created_session_id}")
            
            # Step 3: Teacher accepts session
            accept_response = api_client.post(
                f"{BASE_URL}/api/live-sessions/{created_session_id}/accept",
                headers=teacher_headers
            )
            assert accept_response.status_code == 200, f"Accept session failed: {accept_response.text}"
            print("PASSED: Teacher accepted session")
            
            # Step 4: End session
            end_response = api_client.post(
                f"{BASE_URL}/api/live-sessions/{created_session_id}/end",
                headers=student_headers
            )
            assert end_response.status_code == 200, f"End session failed: {end_response.text}"
            print("PASSED: Session ended")
            
            # Step 5: Student reviews the session with 5 stars
            review_response = api_client.post(
                f"{BASE_URL}/api/live-sessions/{created_session_id}/review",
                json={
                    "rating": 5,
                    "text": "Ottima lezione! Molto professionale."
                },
                headers=student_headers
            )
            assert review_response.status_code == 200, f"Review failed: {review_response.text}"
            review_data = review_response.json()
            assert "id" in review_data or "message" in review_data
            print(f"PASSED: Student review submitted - {review_data}")
            
            # Step 6: Teacher can also review student
            teacher_review_response = api_client.post(
                f"{BASE_URL}/api/live-sessions/{created_session_id}/review",
                json={
                    "rating": 4,
                    "text": "Studente attento e motivato."
                },
                headers=teacher_headers
            )
            assert teacher_review_response.status_code == 200, f"Teacher review failed: {teacher_review_response.text}"
            print(f"PASSED: Teacher review submitted - {teacher_review_response.json()}")
            
            # Step 7: Try to update the review (should update, not duplicate)
            update_review_response = api_client.post(
                f"{BASE_URL}/api/live-sessions/{created_session_id}/review",
                json={
                    "rating": 5,
                    "text": "Aggiornamento: Davvero eccellente!"
                },
                headers=student_headers
            )
            assert update_review_response.status_code == 200
            assert "updated" in update_review_response.json().get("message", "").lower() or "id" in update_review_response.json()
            print("PASSED: Review update works correctly")
            
        finally:
            # Cleanup: Nothing to clean up for reviews (they stay)
            pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
