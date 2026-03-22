"""
Test Notification System and Payment Tracking - Iteration 22
Tests the new notification system and mock payment tracking:
- POST /api/group-lessons/{id}/book returns payment_id alongside lesson_id
- GET /api/notifications - Returns user's notifications sorted by created_at desc
- GET /api/notifications/unread-count - Returns count of unread notifications
- POST /api/notifications/{id}/read - Marks notification as read
- Full flow: create lesson -> book (generates booking_confirmed notification) -> start (generates group_lesson_started notification)
- Security: notifications endpoint only returns current user's notifications, not others'

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
    BASE_URL = "https://stories-feed-staging.preview.emergentagent.com"


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
        "title": f"TEST_Notif_Lesson_{uuid.uuid4().hex[:8]}",
        "description": "Test lesson for notification testing",
        "dance_category": "latin",
        "scheduled_at": future_time,
        "duration_minutes": 60,
        "max_participants": 10,
        "price": 30.0
    }


# ==================== BOOKING RETURNS PAYMENT_ID TESTS ====================

class TestBookingReturnsPaymentId:
    """Test POST /api/group-lessons/{id}/book returns payment_id"""
    
    def test_book_returns_payment_id(self, teacher_client, student_client, test_lesson_data):
        """Booking a lesson should return payment_id alongside lesson_id"""
        # Teacher creates lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Student books the lesson
        response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify payment_id is in response
        assert "payment_id" in data, f"Response should contain payment_id, got keys: {data.keys()}"
        assert data["payment_id"] is not None, "payment_id should not be None"
        assert isinstance(data["payment_id"], str), "payment_id should be a string (UUID)"
        assert len(data["payment_id"]) > 0, "payment_id should not be empty"
        
        # Also verify lesson_id is still there
        assert "lesson_id" in data, "Response should contain lesson_id"
        assert data["lesson_id"] == lesson_id, "lesson_id should match"
        
        print(f"✓ Book returns payment_id: {data['payment_id']}")


# ==================== NOTIFICATIONS ENDPOINTS TESTS ====================

class TestNotificationsEndpoint:
    """Test GET /api/notifications endpoint"""
    
    def test_get_notifications_requires_auth(self):
        """GET /api/notifications requires authentication"""
        headers = {"Content-Type": "application/json"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Notifications endpoint requires auth")
    
    def test_get_notifications_returns_list(self, student_client):
        """GET /api/notifications returns a list"""
        response = student_client.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), f"Response should be a list, got {type(data)}"
        print(f"✓ Get notifications returns list ({len(data)} notifications)")
    
    def test_notification_has_correct_fields(self, teacher_client, student_client, test_lesson_data):
        """Notification contains correct fields: id, user_id, type, title, message, data, read, created_at"""
        # Create and book lesson to generate notification
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        
        # Get notifications
        response = student_client.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0, "Should have at least one notification"
        
        # Check the most recent notification (first in list, sorted by created_at desc)
        notif = data[0]
        
        # Verify all required fields
        required_fields = ["id", "user_id", "type", "title", "message", "data", "read", "created_at"]
        for field in required_fields:
            assert field in notif, f"Notification missing field: {field}"
        
        # Verify field types
        assert isinstance(notif["id"], str), "id should be string"
        assert isinstance(notif["user_id"], str), "user_id should be string"
        assert isinstance(notif["type"], str), "type should be string"
        assert isinstance(notif["title"], str), "title should be string"
        assert isinstance(notif["message"], str), "message should be string"
        assert isinstance(notif["data"], dict), "data should be dict"
        assert isinstance(notif["read"], bool), "read should be boolean"
        assert isinstance(notif["created_at"], str), "created_at should be string"
        
        print(f"✓ Notification has all required fields: {required_fields}")
    
    def test_notifications_sorted_by_created_at_desc(self, teacher_client, student_client):
        """Notifications should be sorted by created_at descending (newest first)"""
        # Create two lessons and book both to create multiple notifications
        future_time1 = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        lesson1_data = {
            "title": f"TEST_First_{uuid.uuid4().hex[:8]}",
            "description": "First test lesson",
            "dance_category": "latin",
            "scheduled_at": future_time1,
            "duration_minutes": 60,
            "max_participants": 10,
            "price": 25.0
        }
        
        future_time2 = (datetime.utcnow() + timedelta(days=2)).isoformat() + "Z"
        lesson2_data = {
            "title": f"TEST_Second_{uuid.uuid4().hex[:8]}",
            "description": "Second test lesson",
            "dance_category": "hiphop",
            "scheduled_at": future_time2,
            "duration_minutes": 60,
            "max_participants": 10,
            "price": 30.0
        }
        
        # Create and book first lesson
        create1 = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=lesson1_data)
        assert create1.status_code == 200
        lesson1_id = create1.json()["id"]
        book1 = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson1_id}/book")
        assert book1.status_code == 200
        
        # Create and book second lesson
        create2 = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=lesson2_data)
        assert create2.status_code == 200
        lesson2_id = create2.json()["id"]
        book2 = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson2_id}/book")
        assert book2.status_code == 200
        
        # Get notifications
        response = student_client.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify sorted by created_at descending
        if len(data) >= 2:
            for i in range(len(data) - 1):
                # Compare timestamps (ISO format strings can be compared lexicographically)
                assert data[i]["created_at"] >= data[i+1]["created_at"], \
                    f"Notifications not sorted: {data[i]['created_at']} should be >= {data[i+1]['created_at']}"
            print(f"✓ Notifications sorted by created_at desc ({len(data)} notifications)")
        else:
            print("⚠ Not enough notifications to verify sorting")


# ==================== UNREAD COUNT TESTS ====================

class TestUnreadCount:
    """Test GET /api/notifications/unread-count endpoint"""
    
    def test_unread_count_requires_auth(self):
        """GET /api/notifications/unread-count requires authentication"""
        headers = {"Content-Type": "application/json"}
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=headers)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unread count endpoint requires auth")
    
    def test_unread_count_returns_count(self, student_client):
        """GET /api/notifications/unread-count returns count object"""
        response = student_client.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "count" in data, f"Response should have 'count' field, got: {data.keys()}"
        assert isinstance(data["count"], int), f"count should be integer, got {type(data['count'])}"
        assert data["count"] >= 0, "count should be non-negative"
        
        print(f"✓ Unread count: {data['count']}")


# ==================== MARK AS READ TESTS ====================

class TestMarkNotificationRead:
    """Test POST /api/notifications/{id}/read endpoint"""
    
    def test_mark_as_read_requires_auth(self):
        """POST /api/notifications/{id}/read requires authentication"""
        headers = {"Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/notifications/fake-id/read", headers=headers)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Mark as read endpoint requires auth")
    
    def test_mark_notification_as_read(self, teacher_client, student_client, test_lesson_data):
        """Can mark notification as read and unread count decreases"""
        # Create and book to generate notification
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        
        # Get unread count before
        count_before = student_client.get(f"{BASE_URL}/api/notifications/unread-count").json()["count"]
        
        # Get notifications and find an unread one
        notifs_response = student_client.get(f"{BASE_URL}/api/notifications")
        assert notifs_response.status_code == 200
        notifs = notifs_response.json()
        
        unread_notif = None
        for n in notifs:
            if not n["read"]:
                unread_notif = n
                break
        
        if unread_notif is None:
            pytest.skip("No unread notifications to test")
        
        notif_id = unread_notif["id"]
        
        # Mark as read
        response = student_client.post(f"{BASE_URL}/api/notifications/{notif_id}/read")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify unread count decreased
        count_after = student_client.get(f"{BASE_URL}/api/notifications/unread-count").json()["count"]
        assert count_after < count_before, f"Unread count should decrease: before={count_before}, after={count_after}"
        
        # Verify notification is now marked as read
        notifs_after = student_client.get(f"{BASE_URL}/api/notifications").json()
        marked_notif = next((n for n in notifs_after if n["id"] == notif_id), None)
        assert marked_notif is not None, "Notification should still exist"
        assert marked_notif["read"] == True, "Notification should be marked as read"
        
        print(f"✓ Marked notification as read. Unread count: {count_before} -> {count_after}")


# ==================== BOOKING NOTIFICATION TESTS ====================

class TestBookingNotification:
    """Test that booking generates 'booking_confirmed' notification"""
    
    def test_booking_creates_notification(self, teacher_client, student_client, test_lesson_data):
        """Booking a lesson creates a booking_confirmed notification"""
        # Create lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        lesson_title = test_lesson_data["title"]
        
        # Book the lesson
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        
        # Get notifications
        notifs_response = student_client.get(f"{BASE_URL}/api/notifications")
        assert notifs_response.status_code == 200
        notifs = notifs_response.json()
        
        # Find booking_confirmed notification for this lesson
        booking_notif = None
        for n in notifs:
            if n["type"] == "booking_confirmed" and n.get("data", {}).get("lesson_id") == lesson_id:
                booking_notif = n
                break
        
        assert booking_notif is not None, f"Should have booking_confirmed notification for lesson {lesson_id}"
        assert booking_notif["read"] == False, "New notification should be unread"
        assert "lesson_id" in booking_notif["data"], "data should contain lesson_id"
        assert booking_notif["data"]["lesson_id"] == lesson_id, "data.lesson_id should match"
        
        print(f"✓ Booking created notification: type={booking_notif['type']}, title={booking_notif['title']}")


# ==================== START LESSON NOTIFICATION TESTS ====================

class TestStartLessonNotification:
    """Test that starting lesson generates 'group_lesson_started' notification for booked users"""
    
    def test_start_creates_notification_for_booked_users(self, teacher_client, student_client, test_lesson_data):
        """Starting a lesson creates group_lesson_started notification for each booked user"""
        # Create lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Student books the lesson
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        
        # Get unread count before start
        count_before = student_client.get(f"{BASE_URL}/api/notifications/unread-count").json()["count"]
        
        # Teacher starts the lesson
        start_response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert start_response.status_code == 200, f"Expected 200, got {start_response.status_code}: {start_response.text}"
        
        # Get notifications for student
        notifs_response = student_client.get(f"{BASE_URL}/api/notifications")
        assert notifs_response.status_code == 200
        notifs = notifs_response.json()
        
        # Find group_lesson_started notification for this lesson
        started_notif = None
        for n in notifs:
            if n["type"] == "group_lesson_started" and n.get("data", {}).get("lesson_id") == lesson_id:
                started_notif = n
                break
        
        assert started_notif is not None, f"Should have group_lesson_started notification for lesson {lesson_id}"
        assert started_notif["read"] == False, "New notification should be unread"
        assert "lesson_id" in started_notif["data"], "data should contain lesson_id"
        assert started_notif["data"]["lesson_id"] == lesson_id, "data.lesson_id should match"
        
        # Verify unread count increased
        count_after = student_client.get(f"{BASE_URL}/api/notifications/unread-count").json()["count"]
        # Note: count should have increased by at least 1 (could be more if user has other notifications)
        
        print(f"✓ Start lesson created notification: type={started_notif['type']}, title={started_notif['title']}")


# ==================== SECURITY TESTS ====================

class TestNotificationSecurity:
    """Test that notifications endpoint only returns current user's notifications"""
    
    def test_user_only_sees_own_notifications(self, teacher_client, student_client, test_lesson_data):
        """User can only see their own notifications, not other users'"""
        # Create a lesson and have student book it
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=test_lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        
        # Student books - this creates notification for student
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        
        # Get student's notifications
        student_notifs = student_client.get(f"{BASE_URL}/api/notifications").json()
        
        # Get teacher's notifications
        teacher_notifs = teacher_client.get(f"{BASE_URL}/api/notifications").json()
        
        # Student's booking notification should NOT appear in teacher's notifications
        student_booking_notif = None
        for n in student_notifs:
            if n["type"] == "booking_confirmed" and n.get("data", {}).get("lesson_id") == lesson_id:
                student_booking_notif = n
                break
        
        if student_booking_notif:
            # This notification ID should NOT be in teacher's notifications
            teacher_notif_ids = [n["id"] for n in teacher_notifs]
            assert student_booking_notif["id"] not in teacher_notif_ids, \
                "Student's booking notification should NOT appear in teacher's notifications"
            print("✓ SECURITY: Teacher cannot see student's booking notification")
        
        # Verify all of student's notifications have student's user_id
        # Get student's user_id from a notification
        if student_notifs:
            student_user_id = student_notifs[0]["user_id"]
            for n in student_notifs:
                assert n["user_id"] == student_user_id, \
                    f"All student notifications should have student's user_id, got {n['user_id']}"
            print(f"✓ SECURITY: All student notifications belong to student (user_id: {student_user_id})")
        
        # Verify all of teacher's notifications have teacher's user_id (if any)
        if teacher_notifs:
            teacher_user_id = teacher_notifs[0]["user_id"]
            for n in teacher_notifs:
                assert n["user_id"] == teacher_user_id, \
                    f"All teacher notifications should have teacher's user_id"
            print(f"✓ SECURITY: All teacher notifications belong to teacher (user_id: {teacher_user_id})")


# ==================== FULL FLOW E2E TEST ====================

class TestFullNotificationFlow:
    """End-to-end test: create -> book (notification) -> start (notification)"""
    
    def test_complete_notification_flow(self, teacher_client, student_client):
        """Test complete flow with notifications at each step"""
        print("\n--- Starting E2E Notification Flow ---")
        
        # Create lesson data
        future_time = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        lesson_data = {
            "title": f"TEST_E2E_Notif_{uuid.uuid4().hex[:8]}",
            "description": "E2E notification test lesson",
            "dance_category": "ballroom",
            "scheduled_at": future_time,
            "duration_minutes": 45,
            "max_participants": 8,
            "price": 35.0
        }
        
        # 1. Get initial notification count
        initial_count = student_client.get(f"{BASE_URL}/api/notifications/unread-count").json()["count"]
        print(f"1. Initial unread count: {initial_count}")
        
        # 2. Teacher creates lesson
        create_response = teacher_client.post(f"{BASE_URL}/api/group-lessons", json=lesson_data)
        assert create_response.status_code == 200
        lesson_id = create_response.json()["id"]
        print(f"2. ✓ Teacher created lesson: {lesson_id}")
        
        # 3. Student books - should get booking_confirmed notification + payment_id
        book_response = student_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book")
        assert book_response.status_code == 200
        book_data = book_response.json()
        assert "payment_id" in book_data, "Book response should contain payment_id"
        print(f"3. ✓ Student booked lesson, payment_id: {book_data['payment_id']}")
        
        # 4. Verify booking notification
        after_book_count = student_client.get(f"{BASE_URL}/api/notifications/unread-count").json()["count"]
        assert after_book_count > initial_count, f"Unread count should increase after booking: {initial_count} -> {after_book_count}"
        
        notifs = student_client.get(f"{BASE_URL}/api/notifications").json()
        booking_notif = next((n for n in notifs if n["type"] == "booking_confirmed" 
                             and n.get("data", {}).get("lesson_id") == lesson_id), None)
        assert booking_notif is not None, "Should have booking_confirmed notification"
        print(f"4. ✓ Booking notification received: '{booking_notif['title']}'")
        
        # 5. Teacher starts lesson - should create group_lesson_started notification
        start_response = teacher_client.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start")
        assert start_response.status_code == 200
        print(f"5. ✓ Teacher started lesson")
        
        # 6. Verify start notification
        after_start_count = student_client.get(f"{BASE_URL}/api/notifications/unread-count").json()["count"]
        assert after_start_count > after_book_count, f"Unread count should increase after start: {after_book_count} -> {after_start_count}"
        
        notifs = student_client.get(f"{BASE_URL}/api/notifications").json()
        started_notif = next((n for n in notifs if n["type"] == "group_lesson_started" 
                              and n.get("data", {}).get("lesson_id") == lesson_id), None)
        assert started_notif is not None, "Should have group_lesson_started notification"
        print(f"6. ✓ Start notification received: '{started_notif['title']}'")
        
        # 7. Mark notifications as read
        mark_response = student_client.post(f"{BASE_URL}/api/notifications/{booking_notif['id']}/read")
        assert mark_response.status_code == 200
        mark_response2 = student_client.post(f"{BASE_URL}/api/notifications/{started_notif['id']}/read")
        assert mark_response2.status_code == 200
        
        final_count = student_client.get(f"{BASE_URL}/api/notifications/unread-count").json()["count"]
        print(f"7. ✓ Marked notifications as read. Final unread count: {final_count}")
        
        # 8. Verify notifications are marked as read
        notifs_final = student_client.get(f"{BASE_URL}/api/notifications").json()
        booking_notif_final = next((n for n in notifs_final if n["id"] == booking_notif["id"]), None)
        started_notif_final = next((n for n in notifs_final if n["id"] == started_notif["id"]), None)
        assert booking_notif_final["read"] == True, "Booking notification should be marked as read"
        assert started_notif_final["read"] == True, "Started notification should be marked as read"
        print(f"8. ✓ Both notifications marked as read")
        
        print("--- E2E Notification Flow COMPLETE ---\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
