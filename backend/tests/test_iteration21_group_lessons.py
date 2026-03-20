"""
Test Group Lessons Feature - Iteration 21
Tests the complete group lesson CRUD flow:
- Teacher creates group lesson
- Student books a lesson
- Teacher starts lesson (creates Daily.co room)
- Student joins lesson
- Teacher ends lesson
- Security: password_hash not exposed in any response

Test credentials:
- Teacher: tutor@test.com / password123
- Student: mario@test.com / password123
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://coaching-connect-8.preview.emergentagent.com"


# ==================== FIXTURES ====================

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def teacher_token(api_client):
    """Get teacher authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "tutor@test.com",
        "password": "password123"
    })
    if response.status_code != 200:
        pytest.skip(f"Teacher login failed: {response.text}")
    data = response.json()
    assert "access_token" in data, f"Expected 'access_token' in response, got: {data.keys()}"
    return data["access_token"]


@pytest.fixture(scope="module")
def student_token(api_client):
    """Get student authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "mario@test.com",
        "password": "password123"
    })
    if response.status_code != 200:
        pytest.skip(f"Student login failed: {response.text}")
    data = response.json()
    assert "access_token" in data, f"Expected 'access_token' in response, got: {data.keys()}"
    return data["access_token"]


@pytest.fixture(scope="module")
def teacher_client(api_client, teacher_token):
    """Session with teacher auth header"""
    api_client.headers.update({"Authorization": f"Bearer {teacher_token}"})
    return api_client


@pytest.fixture
def student_client(student_token):
    """Session with student auth header (separate session)"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {student_token}"
    })
    return session


@pytest.fixture
def test_lesson_data():
    """Generate test lesson data with future scheduled time"""
    future_time = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
    return {
        "title": f"TEST_Group_Lesson_{uuid.uuid4().hex[:8]}",
        "description": "Test group lesson for automated testing",
        "dance_category": "hiphop",
        "scheduled_at": future_time,
        "duration_minutes": 60,
        "max_participants": 10,
        "price": 25.0
    }


# ==================== HELPER FUNCTIONS ====================

def check_no_password_hash(data, context=""):
    """Recursively check that password_hash is not in response"""
    if isinstance(data, dict):
        assert "password_hash" not in data, f"password_hash found in {context}"
        for key, value in data.items():
            check_no_password_hash(value, f"{context}.{key}")
    elif isinstance(data, list):
        for i, item in enumerate(data):
            check_no_password_hash(item, f"{context}[{i}]")


# ==================== AUTH TESTS ====================

class TestGroupLessonAuth:
    """Test authentication requirements for group lesson endpoints"""
    
    def test_create_requires_auth(self, api_client, test_lesson_data):
        """POST /api/group-lessons requires authentication"""
        # Remove auth header if present
        headers = {"Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data, headers=headers)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Create lesson requires auth")
    
    def test_list_requires_auth(self, api_client):
        """GET /api/group-lessons requires authentication"""
        headers = {"Content-Type": "application/json"}
        response = requests.get(f"{BASE_URL}/api/group-lessons", headers=headers)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ List lessons requires auth")
    
    def test_invalid_token_rejected(self, api_client):
        """Invalid token is rejected"""
        headers = {"Authorization": "Bearer invalid_token_12345", "Content-Type": "application/json"}
        response = requests.get(f"{BASE_URL}/api/group-lessons", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid token rejected")


# ==================== CREATE GROUP LESSON TESTS ====================

class TestCreateGroupLesson:
    """Test POST /api/group-lessons - Teacher creates a group lesson"""
    
    def test_teacher_create_lesson_success(self, teacher_client, test_lesson_data):
        """Teacher can create a group lesson"""
        response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain lesson id"
        assert data["title"] == test_lesson_data["title"], "Title should match input"
        assert data["description"] == test_lesson_data["description"], "Description should match"
        assert data["dance_category"] == test_lesson_data["dance_category"], "Dance category should match"
        assert data["price"] == test_lesson_data["price"], "Price should match"
        assert data["max_participants"] == test_lesson_data["max_participants"], "Max participants should match"
        assert data["status"] == "upcoming", "Initial status should be 'upcoming'"
        assert data["booked_count"] == 0, "Initial booked_count should be 0"
        assert data["booked_users"] == [], "Initial booked_users should be empty"
        assert data["room_url"] is None, "room_url should be None initially"
        
        # Verify teacher info is included
        assert "teacher" in data, "Response should include teacher info"
        assert "teacher_id" in data, "Response should include teacher_id"
        
        # SECURITY: Verify no password_hash
        check_no_password_hash(data, "create_response")
        
        print(f"✓ Teacher created lesson: {data['id']}")
        return data["id"]
    
    def test_create_returns_teacher_info(self, teacher_client, test_lesson_data):
        """Create response includes teacher info without password_hash"""
        response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert response.status_code == 200
        
        data = response.json()
        teacher = data.get("teacher", {})
        
        assert "id" in teacher or teacher, "Teacher info should be present"
        if teacher:
            assert "password_hash" not in teacher, "password_hash should NOT be in teacher info"
        
        print("✓ Teacher info included without password_hash")


# ==================== LIST GROUP LESSONS TESTS ====================

class TestListGroupLessons:
    """Test GET /api/group-lessons - List upcoming/live group lessons"""
    
    def test_list_lessons_success(self, teacher_client):
        """Can list group lessons"""
        response = teacher_client.get(f"{BASE_URL}/api/group-lessons")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be an array"
        
        # SECURITY: Check all lessons for password_hash
        check_no_password_hash(data, "list_response")
        
        print(f"✓ Listed {len(data)} group lessons")
    
    def test_list_includes_teacher_info(self, teacher_client, test_lesson_data):
        """Listed lessons include teacher info"""
        # First create a lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        
        # Now list lessons
        response = teacher_client.get(f"{BASE_URL}/api/group-lessons")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find our test lesson
        test_lessons = [l for l in data if l.get("title") == test_lesson_data["title"]]
        
        if test_lessons:
            lesson = test_lessons[0]
            assert "teacher" in lesson, "Listed lessons should include teacher info"
            check_no_password_hash(lesson, "listed_lesson")
            print("✓ Listed lesson includes teacher info without password_hash")
        else:
            print("⚠ Test lesson not found in list (may have been filtered)")
    
    def test_list_only_upcoming_and_live(self, teacher_client):
        """List only returns upcoming and live lessons (not completed)"""
        response = teacher_client.get(f"{BASE_URL}/api/group-lessons")
        assert response.status_code == 200
        
        data = response.json()
        for lesson in data:
            assert lesson["status"] in ["upcoming", "live"], f"Unexpected status: {lesson['status']}"
        
        print(f"✓ All {len(data)} listed lessons have status 'upcoming' or 'live'")


# ==================== GET SINGLE LESSON TESTS ====================

class TestGetSingleLesson:
    """Test GET /api/group-lessons/{id} - Get single lesson details"""
    
    def test_get_lesson_success(self, teacher_client, test_lesson_data):
        """Can get single lesson by ID"""
        # Create a lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Get the lesson
        response = teacher_client.get(f"{BASE_URL}/api/group-lessons/{lesson_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == lesson_id, "Returned lesson should match requested ID"
        assert "teacher" in data, "Response should include teacher info"
        
        # SECURITY: Verify no password_hash
        check_no_password_hash(data, "get_single_response")
        
        print(f"✓ Got single lesson: {lesson_id}")
    
    def test_get_nonexistent_lesson_404(self, teacher_client):
        """Getting non-existent lesson returns 404"""
        fake_id = "nonexistent-lesson-id-12345"
        response = teacher_client.get(f"{BASE_URL}/api/group-lessons/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent lesson returns 404")


# ==================== BOOK LESSON TESTS ====================

class TestBookGroupLesson:
    """Test POST /api/group-lessons/{id}/book - Student books a lesson"""
    
    def test_student_book_lesson_success(self, teacher_client, student_client, test_lesson_data):
        """Student can book a group lesson"""
        # Teacher creates lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Student books the lesson
        response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        assert data["lesson_id"] == lesson_id, "Response should confirm lesson_id"
        
        # Verify booking by getting lesson details
        get_response = teacher_client.get(f"{BASE_URL}/api/group-lessons/{lesson_id}")
        assert get_response.status_code == 200
        lesson = get_response.json()
        assert lesson["booked_count"] == 1, "booked_count should be 1 after booking"
        
        print(f"✓ Student booked lesson: {lesson_id}")
    
    def test_double_booking_rejected(self, teacher_client, student_client, test_lesson_data):
        """Student cannot book the same lesson twice"""
        # Create lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # First booking
        response1 = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert response1.status_code == 200
        
        # Try to book again
        response2 = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert response2.status_code == 400, f"Expected 400 for double booking, got {response2.status_code}"
        
        print("✓ Double booking rejected")
    
    def test_book_nonexistent_lesson_404(self, student_client):
        """Booking non-existent lesson returns 404"""
        fake_id = "nonexistent-lesson-id-12345"
        response = student_client.post(f"{BASE_URL}/api/group-lessons/{fake_id}/book")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Booking non-existent lesson returns 404")


# ==================== CANCEL BOOKING TESTS ====================

class TestCancelBooking:
    """Test DELETE /api/group-lessons/{id}/book - Student cancels booking"""
    
    def test_cancel_booking_success(self, teacher_client, student_client, test_lesson_data):
        """Student can cancel booking"""
        # Create and book lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        
        # Cancel booking
        response = student_client.delete(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify cancellation
        get_response = teacher_client.get(f"{BASE_URL}/api/group-lessons/{lesson_id}")
        lesson = get_response.json()
        assert lesson["booked_count"] == 0, "booked_count should be 0 after cancellation"
        
        print(f"✓ Booking cancelled: {lesson_id}")
    
    def test_cancel_without_booking_rejected(self, teacher_client, student_client, test_lesson_data):
        """Cannot cancel if not booked"""
        # Create lesson (don't book)
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Try to cancel without booking
        response = student_client.delete(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        print("✓ Cancel without booking rejected")


# ==================== MY GROUP LESSONS TESTS ====================

class TestMyGroupLessons:
    """Test GET /api/my-group-lessons - Teacher's own lessons"""
    
    def test_get_my_lessons_success(self, teacher_client, test_lesson_data):
        """Teacher can get their own lessons"""
        # Create a lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Get my lessons
        response = teacher_client.get(f"{BASE_URL}/api/my-group-lessons")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be an array"
        
        # Should contain our test lesson
        lesson_ids = [l["id"] for l in data]
        assert lesson_id in lesson_ids, "Created lesson should be in my-group-lessons"
        
        # SECURITY check
        check_no_password_hash(data, "my_lessons_response")
        
        print(f"✓ Got {len(data)} teacher's own lessons")


# ==================== START LESSON TESTS ====================

class TestStartGroupLesson:
    """Test POST /api/group-lessons/{id}/start - Teacher starts lesson (creates Daily.co room)"""
    
    def test_teacher_start_lesson_success(self, teacher_client, test_lesson_data):
        """Teacher can start a group lesson - creates Daily.co room"""
        # Create lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Start lesson
        response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "room_url" in data, "Response should contain room_url"
        assert data["room_url"] is not None, "room_url should not be None"
        assert "room_name" in data, "Response should contain room_name"
        assert data["room_url"].startswith("https://"), "room_url should be a valid URL"
        
        # Verify lesson status changed to live
        get_response = teacher_client.get(f"{BASE_URL}/api/group-lessons/{lesson_id}")
        lesson = get_response.json()
        assert lesson["status"] == "live", f"Status should be 'live', got '{lesson['status']}'"
        assert lesson["room_url"] == data["room_url"], "room_url should be stored in lesson"
        
        print(f"✓ Teacher started lesson: {lesson_id}")
        print(f"  Room URL: {data['room_url']}")
        
        return lesson_id, data["room_url"]
    
    def test_student_cannot_start_lesson(self, teacher_client, student_client, test_lesson_data):
        """Student cannot start a lesson (only teacher can)"""
        # Teacher creates lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Student tries to start
        response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert response.status_code == 403, f"Expected 403 (forbidden), got {response.status_code}"
        
        print("✓ Student cannot start lesson (403 forbidden)")
    
    def test_start_already_started_returns_existing_room(self, teacher_client, test_lesson_data):
        """Starting an already started lesson returns existing room_url"""
        # Create and start lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        start_response1 = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert start_response1.status_code == 200
        room_url1 = start_response1.json()["room_url"]
        
        # Try to start again
        start_response2 = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert start_response2.status_code == 200
        room_url2 = start_response2.json()["room_url"]
        
        assert room_url1 == room_url2, "Re-starting should return the same room_url"
        
        print("✓ Re-starting returns same room_url (idempotent)")


# ==================== JOIN LESSON TESTS ====================

class TestJoinGroupLesson:
    """Test POST /api/group-lessons/{id}/join - Student joins a live lesson"""
    
    def test_booked_student_join_live_lesson(self, teacher_client, student_client, test_lesson_data):
        """Booked student can join a live lesson"""
        # Create, book, and start lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Student books
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        
        # Teacher starts
        start_response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert start_response.status_code == 200
        teacher_room_url = start_response.json()["room_url"]
        
        # Student joins
        response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/join")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "room_url" in data, "Response should contain room_url"
        assert data["room_url"] == teacher_room_url, "Student should get same room_url as teacher"
        
        print(f"✓ Booked student joined live lesson: {lesson_id}")
    
    def test_unbooked_student_cannot_join(self, teacher_client, student_client, test_lesson_data):
        """Student who didn't book cannot join"""
        # Create and start lesson (no booking)
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        start_response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert start_response.status_code == 200
        
        # Student tries to join without booking
        response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/join")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        print("✓ Unbooked student cannot join (403)")
    
    def test_cannot_join_before_start(self, teacher_client, student_client, test_lesson_data):
        """Cannot join a lesson that hasn't started"""
        # Create and book (don't start)
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        
        # Try to join before start
        response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/join")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        print("✓ Cannot join before lesson starts (400)")


# ==================== END LESSON TESTS ====================

class TestEndGroupLesson:
    """Test POST /api/group-lessons/{id}/end - Teacher ends lesson"""
    
    def test_teacher_end_lesson_success(self, teacher_client, test_lesson_data):
        """Teacher can end a lesson"""
        # Create and start lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        start_response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert start_response.status_code == 200
        
        # End lesson
        response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/end")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify status changed to completed
        get_response = teacher_client.get(f"{BASE_URL}/api/group-lessons/{lesson_id}")
        lesson = get_response.json()
        assert lesson["status"] == "completed", f"Status should be 'completed', got '{lesson['status']}'"
        
        print(f"✓ Teacher ended lesson: {lesson_id}")
    
    def test_student_cannot_end_lesson(self, teacher_client, student_client, test_lesson_data):
        """Student cannot end a lesson (only teacher can)"""
        # Create, book, and start
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        
        start_response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert start_response.status_code == 200
        
        # Student tries to end
        response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/end")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        print("✓ Student cannot end lesson (403)")


# ==================== SECURITY TESTS ====================

class TestSecurityNoPasswordHash:
    """Verify password_hash is NOT exposed in any group lesson API response"""
    
    def test_create_no_password_hash(self, teacher_client, test_lesson_data):
        """POST /api/group-lessons - no password_hash in response"""
        response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert response.status_code == 200
        check_no_password_hash(response.json(), "create_response")
        print("✓ SECURITY: Create - no password_hash")
    
    def test_list_no_password_hash(self, teacher_client):
        """GET /api/group-lessons - no password_hash in list"""
        response = teacher_client.get(f"{BASE_URL}/api/group-lessons")
        assert response.status_code == 200
        check_no_password_hash(response.json(), "list_response")
        print("✓ SECURITY: List - no password_hash")
    
    def test_get_single_no_password_hash(self, teacher_client, test_lesson_data):
        """GET /api/group-lessons/{id} - no password_hash"""
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        lesson_id = create_response.json()["id"]
        
        response = teacher_client.get(f"{BASE_URL}/api/group-lessons/{lesson_id}")
        assert response.status_code == 200
        check_no_password_hash(response.json(), "get_single_response")
        print("✓ SECURITY: Get single - no password_hash")
    
    def test_my_lessons_no_password_hash(self, teacher_client):
        """GET /api/my-group-lessons - no password_hash"""
        response = teacher_client.get(f"{BASE_URL}/api/my-group-lessons")
        assert response.status_code == 200
        check_no_password_hash(response.json(), "my_lessons_response")
        print("✓ SECURITY: My lessons - no password_hash")


# ==================== END-TO-END FLOW TEST ====================

class TestE2EGroupLessonFlow:
    """Complete end-to-end flow: create -> book -> start -> join -> end"""
    
    def test_complete_flow(self, teacher_client, student_client, test_lesson_data):
        """Test complete group lesson lifecycle"""
        print("\n--- Starting E2E Group Lesson Flow ---")
        
        # 1. Teacher creates lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson = create_response.json()
        lesson_id = lesson["id"]
        print(f"1. ✓ Teacher created lesson: {lesson_id}")
        check_no_password_hash(lesson, "create")
        
        # 2. Student books the lesson
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        print(f"2. ✓ Student booked lesson")
        
        # Verify booking reflected
        get_response = teacher_client.get(f"{BASE_URL}/api/group-lessons/{lesson_id}")
        assert get_response.json()["booked_count"] == 1
        
        # 3. Teacher starts the lesson
        start_response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert start_response.status_code == 200
        start_data = start_response.json()
        assert "room_url" in start_data and start_data["room_url"]
        print(f"3. ✓ Teacher started lesson - room_url: {start_data['room_url'][:50]}...")
        
        # Verify lesson is now live
        get_response2 = teacher_client.get(f"{BASE_URL}/api/group-lessons/{lesson_id}")
        lesson_after_start = get_response2.json()
        assert lesson_after_start["status"] == "live"
        check_no_password_hash(lesson_after_start, "after_start")
        
        # 4. Student joins the lesson
        join_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/join")
        assert join_response.status_code == 200
        join_data = join_response.json()
        assert join_data["room_url"] == start_data["room_url"]
        print(f"4. ✓ Student joined lesson")
        
        # 5. Teacher ends the lesson
        end_response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/end")
        assert end_response.status_code == 200
        print(f"5. ✓ Teacher ended lesson")
        
        # Verify final status
        get_response3 = teacher_client.get(f"{BASE_URL}/api/group-lessons/{lesson_id}")
        final_lesson = get_response3.json()
        assert final_lesson["status"] == "completed"
        check_no_password_hash(final_lesson, "final")
        
        print("--- E2E Group Lesson Flow COMPLETE ---\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
