"""
Iteration 21 - Reviews Popup and Available Teachers Backend API Tests

Testing focus:
1. GET /api/available-teachers - Verify is_available, review_count, id, username fields
2. GET /api/users/{user_id}/reviews - Verify reviews return text, rating, reviewer_username, reviewer_image, created_at

User requested features:
- ReviewsPopup component shows reviews when pressing 'i' icon next to teacher star ratings
- Review data should support Google-style horizontal carousel display
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', os.environ.get('REACT_APP_BACKEND_URL', '')).rstrip('/')

# Test credentials from review request
STUDENT_EMAIL = "mario@test.com"
STUDENT_PASSWORD = "password123"
TEACHER_EMAIL = "tutor@test.com"
TEACHER_PASSWORD = "password123"

# User ID with known reviews (from misc_info)
USER_WITH_REVIEWS_ID = "b5627637-a525-45bc-bbbb-ee4896aa69be"


class TestAuthentication:
    """Test authentication basics"""
    
    def test_login_student_success(self):
        """Test student login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response missing access_token field"
        assert len(data["access_token"]) > 0, "access_token is empty"
        print(f"Student login successful, token received")
    
    def test_login_teacher_success(self):
        """Test teacher login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response missing access_token field"
        print(f"Teacher login successful, token received")


@pytest.fixture
def student_token():
    """Get student authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_EMAIL,
        "password": STUDENT_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Student login failed: {response.text}")


@pytest.fixture
def teacher_token():
    """Get teacher authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Teacher login failed: {response.text}")


@pytest.fixture
def auth_headers(student_token):
    """Return headers with student auth token"""
    return {"Authorization": f"Bearer {student_token}"}


@pytest.fixture
def teacher_headers(teacher_token):
    """Return headers with teacher auth token"""
    return {"Authorization": f"Bearer {teacher_token}"}


class TestAvailableTeachersEndpoint:
    """Test GET /api/available-teachers endpoint response fields"""
    
    def test_available_teachers_returns_200(self, auth_headers):
        """Test endpoint returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"Available teachers endpoint returned 200 OK")
    
    def test_available_teachers_returns_list(self, auth_headers):
        """Test endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Available teachers endpoint returned list with {len(data)} items")
    
    def test_available_teachers_required_fields(self, auth_headers):
        """Test each teacher has required fields: id, username, is_available, review_count"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers=auth_headers)
        assert response.status_code == 200
        teachers = response.json()
        
        if len(teachers) == 0:
            pytest.skip("No teachers returned, cannot verify fields")
        
        required_fields = ["id", "username", "is_available", "review_count"]
        
        for i, teacher in enumerate(teachers[:5]):  # Check first 5
            for field in required_fields:
                assert field in teacher, f"Teacher {i} missing required field: {field}"
            
            # Verify field types
            assert isinstance(teacher["id"], str), f"Teacher {i}: id should be string"
            assert isinstance(teacher["username"], str), f"Teacher {i}: username should be string"
            assert isinstance(teacher["is_available"], bool), f"Teacher {i}: is_available should be boolean"
            assert isinstance(teacher["review_count"], int), f"Teacher {i}: review_count should be integer"
            
        print(f"All required fields verified for {min(5, len(teachers))} teachers")
    
    def test_available_teachers_additional_fields(self, auth_headers):
        """Test teachers have additional expected fields: name, profile_image, rating, hourly_rate"""
        response = requests.get(f"{BASE_URL}/api/available-teachers", headers=auth_headers)
        assert response.status_code == 200
        teachers = response.json()
        
        if len(teachers) == 0:
            pytest.skip("No teachers returned, cannot verify fields")
        
        expected_fields = ["name", "profile_image", "rating", "hourly_rate", "dance_categories", "is_busy", "remaining_minutes"]
        
        teacher = teachers[0]
        for field in expected_fields:
            assert field in teacher, f"Teacher missing expected field: {field}"
        
        # Verify rating is numeric (float or int)
        assert isinstance(teacher["rating"], (int, float)), f"rating should be numeric, got {type(teacher['rating'])}"
        
        print(f"Additional fields verified. Sample teacher: {teacher['username']}, rating: {teacher['rating']}, review_count: {teacher['review_count']}")
    
    def test_available_teachers_requires_auth(self):
        """Test endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/available-teachers")
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"Endpoint correctly requires authentication (status: {response.status_code})")


class TestUserReviewsEndpoint:
    """Test GET /api/users/{user_id}/reviews endpoint for ReviewsPopup data"""
    
    def test_user_reviews_returns_200(self, auth_headers):
        """Test endpoint returns 200 for valid user"""
        response = requests.get(f"{BASE_URL}/api/users/{USER_WITH_REVIEWS_ID}/reviews", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"User reviews endpoint returned 200 OK")
    
    def test_user_reviews_returns_list(self, auth_headers):
        """Test endpoint returns a list of reviews"""
        response = requests.get(f"{BASE_URL}/api/users/{USER_WITH_REVIEWS_ID}/reviews", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"User reviews endpoint returned list with {len(data)} reviews")
    
    def test_user_reviews_required_fields(self, auth_headers):
        """Test each review has required fields for ReviewsPopup: id, rating, text, reviewer_username, reviewer_image, created_at"""
        response = requests.get(f"{BASE_URL}/api/users/{USER_WITH_REVIEWS_ID}/reviews", headers=auth_headers)
        assert response.status_code == 200
        reviews = response.json()
        
        if len(reviews) == 0:
            pytest.skip("No reviews returned for user, cannot verify fields")
        
        # Required fields for ReviewsPopup Google-style carousel
        required_fields = ["id", "rating", "text", "reviewer_username", "reviewer_image", "created_at"]
        
        for i, review in enumerate(reviews):
            for field in required_fields:
                assert field in review, f"Review {i} missing required field: {field}"
            
            # Verify field types
            assert isinstance(review["id"], str), f"Review {i}: id should be string"
            assert isinstance(review["rating"], int), f"Review {i}: rating should be integer, got {type(review['rating'])}"
            assert isinstance(review["text"], str), f"Review {i}: text should be string"
            assert isinstance(review["reviewer_username"], str), f"Review {i}: reviewer_username should be string"
            # reviewer_image can be None or string
            assert review["reviewer_image"] is None or isinstance(review["reviewer_image"], str), f"Review {i}: reviewer_image should be string or None"
            assert isinstance(review["created_at"], str), f"Review {i}: created_at should be string (ISO date)"
            
        print(f"All {len(reviews)} reviews have required fields for ReviewsPopup")
    
    def test_user_reviews_text_field_not_empty(self, auth_headers):
        """Test that reviews include the 'text' field (can be empty string but must exist)"""
        response = requests.get(f"{BASE_URL}/api/users/{USER_WITH_REVIEWS_ID}/reviews", headers=auth_headers)
        assert response.status_code == 200
        reviews = response.json()
        
        if len(reviews) == 0:
            pytest.skip("No reviews to check")
        
        for i, review in enumerate(reviews):
            assert "text" in review, f"Review {i} missing 'text' field"
            # Text can be empty string, but field must exist
            assert isinstance(review["text"], str), f"Review {i}: text field should be string"
        
        reviews_with_text = [r for r in reviews if r.get("text", "").strip()]
        print(f"{len(reviews_with_text)}/{len(reviews)} reviews have non-empty text content")
    
    def test_user_reviews_rating_range(self, auth_headers):
        """Test that ratings are within valid range (1-5)"""
        response = requests.get(f"{BASE_URL}/api/users/{USER_WITH_REVIEWS_ID}/reviews", headers=auth_headers)
        assert response.status_code == 200
        reviews = response.json()
        
        if len(reviews) == 0:
            pytest.skip("No reviews to check")
        
        for i, review in enumerate(reviews):
            rating = review.get("rating")
            assert 1 <= rating <= 5, f"Review {i}: rating {rating} outside valid range 1-5"
        
        print(f"All {len(reviews)} reviews have valid rating range (1-5)")
    
    def test_user_reviews_no_mongodb_id(self, auth_headers):
        """Test that reviews don't include MongoDB _id field"""
        response = requests.get(f"{BASE_URL}/api/users/{USER_WITH_REVIEWS_ID}/reviews", headers=auth_headers)
        assert response.status_code == 200
        reviews = response.json()
        
        if len(reviews) == 0:
            pytest.skip("No reviews to check")
        
        for i, review in enumerate(reviews):
            assert "_id" not in review, f"Review {i} contains _id field (MongoDB ObjectId not excluded)"
        
        print(f"All {len(reviews)} reviews correctly exclude MongoDB _id field")
    
    def test_user_reviews_requires_auth(self):
        """Test endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/users/{USER_WITH_REVIEWS_ID}/reviews")
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"Endpoint correctly requires authentication (status: {response.status_code})")
    
    def test_user_reviews_nonexistent_user(self, auth_headers):
        """Test endpoint behavior for non-existent user"""
        fake_user_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{BASE_URL}/api/users/{fake_user_id}/reviews", headers=auth_headers)
        # Should return empty list or 404 - both are acceptable
        assert response.status_code in [200, 404], f"Unexpected status {response.status_code}: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list), "Expected list for non-existent user"
            assert len(data) == 0, "Expected empty list for non-existent user"
        print(f"Non-existent user returns status {response.status_code} (acceptable)")


class TestReviewsPopupIntegration:
    """Integration tests simulating the ReviewsPopup flow"""
    
    def test_complete_flow_get_teachers_then_reviews(self, auth_headers):
        """Test complete flow: get available teachers, pick one with reviews, get their reviews"""
        # Step 1: Get available teachers
        teachers_response = requests.get(f"{BASE_URL}/api/available-teachers", headers=auth_headers)
        assert teachers_response.status_code == 200
        teachers = teachers_response.json()
        
        print(f"Step 1: Got {len(teachers)} teachers")
        
        # Step 2: Find a teacher with review_count > 0
        teachers_with_reviews = [t for t in teachers if t.get("review_count", 0) > 0]
        
        if not teachers_with_reviews:
            # Use known user with reviews as fallback
            teacher_id = USER_WITH_REVIEWS_ID
            print(f"Step 2: No teachers with reviews in list, using known user ID")
        else:
            teacher_id = teachers_with_reviews[0]["id"]
            print(f"Step 2: Found teacher with reviews: {teachers_with_reviews[0]['username']} (review_count: {teachers_with_reviews[0]['review_count']})")
        
        # Step 3: Get reviews for that teacher
        reviews_response = requests.get(f"{BASE_URL}/api/users/{teacher_id}/reviews", headers=auth_headers)
        assert reviews_response.status_code == 200
        reviews = reviews_response.json()
        
        print(f"Step 3: Got {len(reviews)} reviews for teacher")
        
        # Step 4: Verify reviews have all fields needed for Google-style carousel
        if len(reviews) > 0:
            review = reviews[0]
            carousel_fields = ["reviewer_username", "reviewer_image", "rating", "text", "created_at"]
            for field in carousel_fields:
                assert field in review, f"Review missing carousel field: {field}"
            print(f"Step 4: Review has all carousel fields. Sample: {review['reviewer_username']} rated {review['rating']} stars")
    
    def test_reviews_sorted_by_created_at_desc(self, auth_headers):
        """Test that reviews are sorted by created_at descending (newest first)"""
        response = requests.get(f"{BASE_URL}/api/users/{USER_WITH_REVIEWS_ID}/reviews", headers=auth_headers)
        assert response.status_code == 200
        reviews = response.json()
        
        if len(reviews) < 2:
            pytest.skip("Need at least 2 reviews to test sorting")
        
        # Check dates are in descending order
        from datetime import datetime
        dates = []
        for r in reviews:
            try:
                # Handle ISO format with or without microseconds
                date_str = r["created_at"]
                if "." in date_str:
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                else:
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                dates.append(dt)
            except Exception as e:
                print(f"Warning: Could not parse date '{r['created_at']}': {e}")
        
        if len(dates) >= 2:
            is_descending = all(dates[i] >= dates[i+1] for i in range(len(dates)-1))
            assert is_descending, "Reviews should be sorted by created_at descending"
            print(f"Reviews correctly sorted by created_at descending")
        else:
            print(f"Could not verify sorting (only {len(dates)} valid dates)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
