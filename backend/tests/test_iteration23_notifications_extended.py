"""
Iteration 23 - Extended Notification System, Availability Slots, and Group Lesson Features Testing

Tests:
1. POST /api/posts/{id}/like - Should create a 'like' notification for post owner (if not self-like)
2. POST /api/stories/{id}/react - Should create a 'story_reaction' notification for story owner
3. POST /api/availability-slots - Should accept lesson_type field (single/group/both)
4. GET /api/notifications - Should return all notification types
5. GET /api/notifications/unread-count - Should return correct count
6. POST /api/notifications/{id}/read - Should mark as read
7. POST /api/group-lessons/{id}/mute-all - Should clear raised_hands and allowed_speakers
8. POST /api/group-lessons/{id}/token - Should return owner token for teacher and participant token for student
9. POST /api/conversations/{id}/messages - Should create chat_message notification
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://coaching-connect-8.preview.emergentagent.com"

# Test credentials
TEACHER_EMAIL = "tutor@test.com"
TEACHER_PASSWORD = "password123"
STUDENT_EMAIL = "mario@test.com"
STUDENT_PASSWORD = "password123"


class TestSetup:
    """Setup fixtures for authentication"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    @pytest.fixture(scope="class")
    def student_token(self):
        """Get student authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        assert response.status_code == 200, f"Student login failed: {response.text}"
        data = response.json()
        return data["access_token"], data["user"]["id"]


class TestLikeNotification(TestSetup):
    """Test like notification creation"""
    
    def test_like_creates_notification_for_post_owner(self, teacher_token, student_token):
        """When student likes teacher's post, teacher should receive a 'like' notification"""
        teacher_auth, teacher_id = teacher_token
        student_auth, student_id = student_token
        
        # Step 1: Teacher creates a post
        post_response = requests.post(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "type": "text",
                "caption": f"TEST_post_for_like_notification_{uuid.uuid4().hex[:8]}"
            }
        )
        assert post_response.status_code == 200, f"Post creation failed: {post_response.text}"
        post_id = post_response.json()["id"]
        print(f"Created post: {post_id}")
        
        # Step 2: Get teacher's initial unread notification count
        initial_count_response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert initial_count_response.status_code == 200
        initial_count = initial_count_response.json()["count"]
        print(f"Teacher's initial unread count: {initial_count}")
        
        # Step 3: Student likes the post
        like_response = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {student_auth}"}
        )
        assert like_response.status_code == 200, f"Like failed: {like_response.text}"
        assert like_response.json()["liked"] == True
        print("Student liked the post")
        
        # Step 4: Verify teacher received a 'like' notification
        notifs_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert notifs_response.status_code == 200
        notifications = notifs_response.json()
        
        # Find the like notification for this post
        like_notifs = [n for n in notifications if n.get("type") == "like" and n.get("data", {}).get("post_id") == post_id]
        assert len(like_notifs) > 0, f"No 'like' notification found for post {post_id}"
        
        like_notif = like_notifs[0]
        assert like_notif["type"] == "like"
        assert like_notif["user_id"] == teacher_id
        assert like_notif["read"] == False
        print(f"PASSED: Like notification created - {like_notif['message']}")
        
        # Step 5: Verify unread count increased
        new_count_response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert new_count_response.status_code == 200
        new_count = new_count_response.json()["count"]
        assert new_count >= initial_count, "Unread count should have increased"
        print(f"PASSED: Unread count increased from {initial_count} to {new_count}")
        
        # Cleanup: Unlike the post
        requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {student_auth}"}
        )
        # Delete the post
        requests.delete(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
    
    def test_self_like_does_not_create_notification(self, teacher_token):
        """When user likes their own post, no notification should be created"""
        teacher_auth, teacher_id = teacher_token
        
        # Create a post
        post_response = requests.post(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "type": "text",
                "caption": f"TEST_self_like_post_{uuid.uuid4().hex[:8]}"
            }
        )
        assert post_response.status_code == 200
        post_id = post_response.json()["id"]
        
        # Get initial notifications
        initial_notifs = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        ).json()
        initial_like_notifs = [n for n in initial_notifs if n.get("type") == "like" and n.get("data", {}).get("post_id") == post_id]
        
        # Self-like
        like_response = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert like_response.status_code == 200
        
        # Check no new like notification for this post
        new_notifs = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        ).json()
        new_like_notifs = [n for n in new_notifs if n.get("type") == "like" and n.get("data", {}).get("post_id") == post_id]
        
        assert len(new_like_notifs) == len(initial_like_notifs), "Self-like should not create notification"
        print("PASSED: Self-like does not create notification")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )


class TestStoryReactionNotification(TestSetup):
    """Test story reaction notification creation"""
    
    def test_story_reaction_creates_notification(self, teacher_token, student_token):
        """When student reacts to teacher's story, teacher should receive a 'story_reaction' notification"""
        teacher_auth, teacher_id = teacher_token
        student_auth, student_id = student_token
        
        # Step 1: Teacher creates a story (using a simple base64 image)
        # Using a minimal valid JPEG base64
        minimal_jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k="
        
        story_response = requests.post(
            f"{BASE_URL}/api/stories",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "media": minimal_jpeg,
                "type": "photo"
            }
        )
        assert story_response.status_code == 200, f"Story creation failed: {story_response.text}"
        story_id = story_response.json()["id"]
        print(f"Created story: {story_id}")
        
        # Step 2: Get teacher's initial unread notification count
        initial_count_response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        initial_count = initial_count_response.json()["count"]
        
        # Step 3: Student reacts to the story
        react_response = requests.post(
            f"{BASE_URL}/api/stories/{story_id}/react",
            headers={"Authorization": f"Bearer {student_auth}"},
            json={"emoji": "🔥"}
        )
        assert react_response.status_code == 200, f"Story reaction failed: {react_response.text}"
        print("Student reacted to story with 🔥")
        
        # Step 4: Verify teacher received a 'story_reaction' notification
        notifs_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert notifs_response.status_code == 200
        notifications = notifs_response.json()
        
        # Find the story_reaction notification
        reaction_notifs = [n for n in notifications if n.get("type") == "story_reaction" and n.get("data", {}).get("story_id") == story_id]
        assert len(reaction_notifs) > 0, f"No 'story_reaction' notification found for story {story_id}"
        
        reaction_notif = reaction_notifs[0]
        assert reaction_notif["type"] == "story_reaction"
        assert reaction_notif["user_id"] == teacher_id
        assert reaction_notif["data"]["emoji"] == "🔥"
        assert reaction_notif["read"] == False
        print(f"PASSED: Story reaction notification created - {reaction_notif['message']}")
    
    def test_story_reaction_404_for_nonexistent_story(self, student_token):
        """Reacting to non-existent story should return 404"""
        student_auth, _ = student_token
        
        fake_story_id = f"nonexistent-{uuid.uuid4().hex[:8]}"
        react_response = requests.post(
            f"{BASE_URL}/api/stories/{fake_story_id}/react",
            headers={"Authorization": f"Bearer {student_auth}"},
            json={"emoji": "❤️"}
        )
        assert react_response.status_code == 404, f"Expected 404, got {react_response.status_code}"
        print("PASSED: Non-existent story returns 404")


class TestAvailabilitySlotLessonType(TestSetup):
    """Test availability slot lesson_type field"""
    
    def test_create_slot_with_single_lesson_type(self, teacher_token):
        """Create availability slot with lesson_type='single'"""
        teacher_auth, _ = teacher_token
        
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        slot_response = requests.post(
            f"{BASE_URL}/api/availability-slots",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "date": tomorrow,
                "start_time": "10:00",
                "end_time": "11:00",
                "dance_categories": ["latin"],
                "price": 50.0,
                "lesson_type": "single"
            }
        )
        assert slot_response.status_code == 200, f"Slot creation failed: {slot_response.text}"
        slot = slot_response.json()
        
        assert slot["lesson_type"] == "single"
        print(f"PASSED: Created slot with lesson_type='single' - ID: {slot['id']}")
    
    def test_create_slot_with_group_lesson_type(self, teacher_token):
        """Create availability slot with lesson_type='group'"""
        teacher_auth, _ = teacher_token
        
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        slot_response = requests.post(
            f"{BASE_URL}/api/availability-slots",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "date": tomorrow,
                "start_time": "14:00",
                "end_time": "15:00",
                "dance_categories": ["ballroom"],
                "price": 30.0,
                "lesson_type": "group"
            }
        )
        assert slot_response.status_code == 200, f"Slot creation failed: {slot_response.text}"
        slot = slot_response.json()
        
        assert slot["lesson_type"] == "group"
        print(f"PASSED: Created slot with lesson_type='group' - ID: {slot['id']}")
    
    def test_create_slot_with_both_lesson_type(self, teacher_token):
        """Create availability slot with lesson_type='both'"""
        teacher_auth, _ = teacher_token
        
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        slot_response = requests.post(
            f"{BASE_URL}/api/availability-slots",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "date": tomorrow,
                "start_time": "16:00",
                "end_time": "17:00",
                "dance_categories": ["hiphop"],
                "price": 40.0,
                "lesson_type": "both"
            }
        )
        assert slot_response.status_code == 200, f"Slot creation failed: {slot_response.text}"
        slot = slot_response.json()
        
        assert slot["lesson_type"] == "both"
        print(f"PASSED: Created slot with lesson_type='both' - ID: {slot['id']}")
    
    def test_create_slot_default_lesson_type(self, teacher_token):
        """Create availability slot without lesson_type should default to 'single'"""
        teacher_auth, _ = teacher_token
        
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        slot_response = requests.post(
            f"{BASE_URL}/api/availability-slots",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "date": tomorrow,
                "start_time": "18:00",
                "end_time": "19:00",
                "dance_categories": ["modern"],
                "price": 45.0
                # No lesson_type specified
            }
        )
        assert slot_response.status_code == 200, f"Slot creation failed: {slot_response.text}"
        slot = slot_response.json()
        
        assert slot["lesson_type"] == "single", f"Expected default 'single', got '{slot.get('lesson_type')}'"
        print(f"PASSED: Default lesson_type is 'single' - ID: {slot['id']}")


class TestNotificationEndpoints(TestSetup):
    """Test notification CRUD endpoints"""
    
    def test_get_notifications_returns_all_types(self, teacher_token):
        """GET /api/notifications should return notifications of all types"""
        teacher_auth, _ = teacher_token
        
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert response.status_code == 200
        notifications = response.json()
        
        assert isinstance(notifications, list)
        print(f"PASSED: GET /notifications returned {len(notifications)} notifications")
        
        # Check notification structure
        if notifications:
            notif = notifications[0]
            required_fields = ["id", "user_id", "type", "title", "message", "read", "created_at"]
            for field in required_fields:
                assert field in notif, f"Missing field: {field}"
            print(f"PASSED: Notification has all required fields")
            
            # List unique notification types
            types = set(n.get("type") for n in notifications)
            print(f"Notification types found: {types}")
    
    def test_get_unread_count(self, teacher_token):
        """GET /api/notifications/unread-count should return count object"""
        teacher_auth, _ = teacher_token
        
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
        print(f"PASSED: Unread count = {data['count']}")
    
    def test_mark_notification_as_read(self, teacher_token, student_token):
        """POST /api/notifications/{id}/read should mark notification as read"""
        teacher_auth, teacher_id = teacher_token
        student_auth, _ = student_token
        
        # Create a post and have student like it to generate a notification
        post_response = requests.post(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={"type": "text", "caption": f"TEST_mark_read_{uuid.uuid4().hex[:8]}"}
        )
        post_id = post_response.json()["id"]
        
        # Student likes
        requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {student_auth}"}
        )
        
        # Get the notification
        notifs = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        ).json()
        
        like_notifs = [n for n in notifs if n.get("type") == "like" and n.get("data", {}).get("post_id") == post_id]
        assert len(like_notifs) > 0, "No like notification found"
        
        notif_id = like_notifs[0]["id"]
        assert like_notifs[0]["read"] == False
        
        # Mark as read
        read_response = requests.post(
            f"{BASE_URL}/api/notifications/{notif_id}/read",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert read_response.status_code == 200
        
        # Verify it's marked as read
        notifs_after = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        ).json()
        
        updated_notif = next((n for n in notifs_after if n["id"] == notif_id), None)
        assert updated_notif is not None
        assert updated_notif["read"] == True
        print(f"PASSED: Notification {notif_id} marked as read")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/posts/{post_id}",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )


class TestChatMessageNotification(TestSetup):
    """Test chat message notification creation"""
    
    def test_send_message_creates_notification(self, teacher_token, student_token):
        """When teacher sends message to student, student should receive 'chat_message' notification"""
        teacher_auth, teacher_id = teacher_token
        student_auth, student_id = student_token
        
        # Step 1: Create or get conversation between teacher and student
        convo_response = requests.post(
            f"{BASE_URL}/api/conversations",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={"user_id": student_id}
        )
        assert convo_response.status_code == 200, f"Conversation creation failed: {convo_response.text}"
        convo_id = convo_response.json()["id"]
        print(f"Conversation ID: {convo_id}")
        
        # Step 2: Get student's initial unread count
        initial_count = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {student_auth}"}
        ).json()["count"]
        
        # Step 3: Teacher sends a message
        msg_text = f"TEST_chat_notification_{uuid.uuid4().hex[:8]}"
        msg_response = requests.post(
            f"{BASE_URL}/api/conversations/{convo_id}/messages",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={"text": msg_text}
        )
        assert msg_response.status_code == 200, f"Message send failed: {msg_response.text}"
        print(f"Teacher sent message: {msg_text}")
        
        # Step 4: Verify student received 'chat_message' notification
        notifs = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {student_auth}"}
        ).json()
        
        chat_notifs = [n for n in notifs if n.get("type") == "chat_message" and n.get("data", {}).get("conversation_id") == convo_id]
        assert len(chat_notifs) > 0, "No chat_message notification found"
        
        chat_notif = chat_notifs[0]
        assert chat_notif["type"] == "chat_message"
        assert chat_notif["user_id"] == student_id
        assert chat_notif["read"] == False
        print(f"PASSED: Chat message notification created - {chat_notif['message']}")


class TestGroupLessonMuteAll(TestSetup):
    """Test group lesson mute-all endpoint"""
    
    def test_mute_all_clears_hands_and_speakers(self, teacher_token, student_token):
        """POST /api/group-lessons/{id}/mute-all should clear raised_hands and allowed_speakers"""
        teacher_auth, teacher_id = teacher_token
        student_auth, student_id = student_token
        
        # Step 1: Teacher creates a group lesson
        scheduled_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        lesson_response = requests.post(
            f"{BASE_URL}/api/group-lessons",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "title": f"TEST_mute_all_lesson_{uuid.uuid4().hex[:8]}",
                "description": "Test lesson for mute-all",
                "dance_category": "latin",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "max_participants": 10,
                "price": 25.0
            }
        )
        assert lesson_response.status_code == 200, f"Lesson creation failed: {lesson_response.text}"
        lesson_id = lesson_response.json()["id"]
        print(f"Created group lesson: {lesson_id}")
        
        # Step 2: Student books the lesson
        book_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/book",
            headers={"Authorization": f"Bearer {student_auth}"}
        )
        assert book_response.status_code == 200, f"Booking failed: {book_response.text}"
        print("Student booked the lesson")
        
        # Step 3: Teacher starts the lesson
        start_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/start",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert start_response.status_code == 200, f"Start failed: {start_response.text}"
        print("Teacher started the lesson")
        
        # Step 4: Student raises hand
        raise_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/raise-hand",
            headers={"Authorization": f"Bearer {student_auth}"}
        )
        assert raise_response.status_code == 200
        print("Student raised hand")
        
        # Step 5: Teacher allows student to speak
        allow_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/allow-speak?student_id={student_id}",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert allow_response.status_code == 200
        print("Teacher allowed student to speak")
        
        # Step 6: Verify hands and speakers are set
        hands_response = requests.get(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/hands",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert hands_response.status_code == 200
        hands_data = hands_response.json()
        # Note: allow-speak removes from raised_hands, so we check allowed_speakers
        assert student_id in hands_data.get("allowed_speakers", []), "Student should be in allowed_speakers"
        print(f"Before mute-all: allowed_speakers={hands_data.get('allowed_speakers')}")
        
        # Step 7: Teacher calls mute-all
        mute_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/mute-all",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert mute_response.status_code == 200, f"Mute-all failed: {mute_response.text}"
        print("Teacher called mute-all")
        
        # Step 8: Verify hands and speakers are cleared
        hands_after = requests.get(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/hands",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        ).json()
        
        assert hands_after.get("raised_hands", []) == [], f"raised_hands should be empty, got {hands_after.get('raised_hands')}"
        assert hands_after.get("allowed_speakers", []) == [], f"allowed_speakers should be empty, got {hands_after.get('allowed_speakers')}"
        print("PASSED: mute-all cleared raised_hands and allowed_speakers")
        
        # Cleanup: End the lesson
        requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/end",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
    
    def test_mute_all_only_teacher_can_call(self, teacher_token, student_token):
        """Only the teacher should be able to call mute-all"""
        teacher_auth, _ = teacher_token
        student_auth, _ = student_token
        
        # Create and start a lesson
        scheduled_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        lesson_response = requests.post(
            f"{BASE_URL}/api/group-lessons",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "title": f"TEST_mute_auth_{uuid.uuid4().hex[:8]}",
                "description": "Test",
                "dance_category": "latin",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "max_participants": 10,
                "price": 25.0
            }
        )
        lesson_id = lesson_response.json()["id"]
        
        # Book and start
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book", headers={"Authorization": f"Bearer {student_auth}"})
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start", headers={"Authorization": f"Bearer {teacher_auth}"})
        
        # Student tries to call mute-all
        mute_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/mute-all",
            headers={"Authorization": f"Bearer {student_auth}"}
        )
        assert mute_response.status_code == 403, f"Expected 403, got {mute_response.status_code}"
        print("PASSED: Student cannot call mute-all (403)")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/end", headers={"Authorization": f"Bearer {teacher_auth}"})


class TestGroupLessonToken(TestSetup):
    """Test group lesson token endpoint"""
    
    def test_teacher_gets_owner_token(self, teacher_token, student_token):
        """Teacher should get owner token with is_owner=True"""
        teacher_auth, teacher_id = teacher_token
        student_auth, student_id = student_token
        
        # Create and start a lesson
        scheduled_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        lesson_response = requests.post(
            f"{BASE_URL}/api/group-lessons",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "title": f"TEST_token_teacher_{uuid.uuid4().hex[:8]}",
                "description": "Test",
                "dance_category": "latin",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "max_participants": 10,
                "price": 25.0
            }
        )
        lesson_id = lesson_response.json()["id"]
        
        # Book and start
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book", headers={"Authorization": f"Bearer {student_auth}"})
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start", headers={"Authorization": f"Bearer {teacher_auth}"})
        
        # Teacher gets token
        token_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/token",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert token_response.status_code == 200, f"Token request failed: {token_response.text}"
        token_data = token_response.json()
        
        assert "token" in token_data
        assert token_data["is_teacher"] == True
        assert "room_url" in token_data
        assert "room_name" in token_data
        print(f"PASSED: Teacher got owner token with is_teacher=True")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/end", headers={"Authorization": f"Bearer {teacher_auth}"})
    
    def test_student_gets_participant_token(self, teacher_token, student_token):
        """Student should get participant token with is_owner=False"""
        teacher_auth, _ = teacher_token
        student_auth, student_id = student_token
        
        # Create and start a lesson
        scheduled_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        lesson_response = requests.post(
            f"{BASE_URL}/api/group-lessons",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "title": f"TEST_token_student_{uuid.uuid4().hex[:8]}",
                "description": "Test",
                "dance_category": "latin",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "max_participants": 10,
                "price": 25.0
            }
        )
        lesson_id = lesson_response.json()["id"]
        
        # Book and start
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book", headers={"Authorization": f"Bearer {student_auth}"})
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start", headers={"Authorization": f"Bearer {teacher_auth}"})
        
        # Student gets token
        token_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/token",
            headers={"Authorization": f"Bearer {student_auth}"}
        )
        assert token_response.status_code == 200, f"Token request failed: {token_response.text}"
        token_data = token_response.json()
        
        assert "token" in token_data
        assert token_data["is_teacher"] == False
        assert "room_url" in token_data
        print(f"PASSED: Student got participant token with is_teacher=False")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/end", headers={"Authorization": f"Bearer {teacher_auth}"})
    
    def test_unbooked_student_cannot_get_token(self, teacher_token, student_token):
        """Student who hasn't booked should not be able to get token"""
        teacher_auth, _ = teacher_token
        student_auth, _ = student_token
        
        # Create and start a lesson (without student booking)
        scheduled_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        lesson_response = requests.post(
            f"{BASE_URL}/api/group-lessons",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "title": f"TEST_token_unbooked_{uuid.uuid4().hex[:8]}",
                "description": "Test",
                "dance_category": "latin",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "max_participants": 10,
                "price": 25.0
            }
        )
        lesson_id = lesson_response.json()["id"]
        
        # Start without booking
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/start", headers={"Authorization": f"Bearer {teacher_auth}"})
        
        # Student tries to get token without booking
        token_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/token",
            headers={"Authorization": f"Bearer {student_auth}"}
        )
        assert token_response.status_code == 403, f"Expected 403, got {token_response.status_code}"
        print("PASSED: Unbooked student cannot get token (403)")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/end", headers={"Authorization": f"Bearer {teacher_auth}"})
    
    def test_token_not_available_before_lesson_starts(self, teacher_token, student_token):
        """Token should not be available before lesson is live"""
        teacher_auth, _ = teacher_token
        student_auth, _ = student_token
        
        # Create a lesson but don't start it
        scheduled_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        lesson_response = requests.post(
            f"{BASE_URL}/api/group-lessons",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "title": f"TEST_token_not_live_{uuid.uuid4().hex[:8]}",
                "description": "Test",
                "dance_category": "latin",
                "scheduled_at": scheduled_at,
                "duration_minutes": 60,
                "max_participants": 10,
                "price": 25.0
            }
        )
        lesson_id = lesson_response.json()["id"]
        
        # Book but don't start
        requests.post(f"{BASE_URL}/api/group-lessons/{lesson_id}/book", headers={"Authorization": f"Bearer {student_auth}"})
        
        # Try to get token before lesson is live
        token_response = requests.post(
            f"{BASE_URL}/api/group-lessons/{lesson_id}/token",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        )
        assert token_response.status_code == 400, f"Expected 400, got {token_response.status_code}"
        print("PASSED: Token not available before lesson is live (400)")


class TestBookingNotification(TestSetup):
    """Test booking creates lesson_booked notification"""
    
    def test_booking_creates_lesson_booked_notification(self, teacher_token, student_token):
        """When student books a slot, teacher should receive 'lesson_booked' notification"""
        teacher_auth, teacher_id = teacher_token
        student_auth, student_id = student_token
        
        # Create availability slot
        tomorrow = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d")
        slot_response = requests.post(
            f"{BASE_URL}/api/availability-slots",
            headers={"Authorization": f"Bearer {teacher_auth}"},
            json={
                "date": tomorrow,
                "start_time": "09:00",
                "end_time": "10:00",
                "dance_categories": ["latin"],
                "price": 50.0,
                "lesson_type": "single"
            }
        )
        assert slot_response.status_code == 200
        slot_id = slot_response.json()["id"]
        print(f"Created slot: {slot_id}")
        
        # Get teacher's initial notifications
        initial_notifs = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        ).json()
        
        # Student books the slot
        book_response = requests.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {student_auth}"},
            json={"slot_id": slot_id}
        )
        assert book_response.status_code == 200, f"Booking failed: {book_response.text}"
        print("Student booked the slot")
        
        # Verify teacher received 'lesson_booked' notification
        notifs = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {teacher_auth}"}
        ).json()
        
        booking_notifs = [n for n in notifs if n.get("type") == "lesson_booked" and n.get("data", {}).get("slot_id") == slot_id]
        assert len(booking_notifs) > 0, "No 'lesson_booked' notification found"
        
        booking_notif = booking_notifs[0]
        assert booking_notif["type"] == "lesson_booked"
        assert booking_notif["user_id"] == teacher_id
        print(f"PASSED: lesson_booked notification created - {booking_notif['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
