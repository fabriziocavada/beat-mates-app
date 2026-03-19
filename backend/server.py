from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse, Response, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import asyncio
import jwt
import base64
import json
from bson import ObjectId
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'beatmates')]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'beatmates-secret-key-2025-production-secure')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Helper to strip MongoDB _id from documents
def clean_doc(doc):
    """Remove MongoDB _id field from a document to avoid ObjectId serialization errors"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [clean_doc(d) for d in doc]
    if isinstance(doc, dict):
        return {k: v for k, v in doc.items() if k != '_id'}
    return doc

# Custom JSON encoder for MongoDB ObjectId
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# Uploads directory
UPLOADS_DIR = ROOT_DIR / 'uploads'
UPLOADS_DIR.mkdir(exist_ok=True)


# Create the main app
app = FastAPI(title="Beat Mates API")

# Serve uploaded files
from starlette.staticfiles import StaticFiles
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    username: str
    name: str
    bio: Optional[str] = ""
    profile_image: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    name: str
    password: str

class UserLogin(BaseModel):
    email: str  # Accept both email and username
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    name: str
    bio: str = ""
    profile_image: Optional[str] = None
    dance_categories: List[str] = []
    is_available: bool = False
    hourly_rate: float = 0
    rating: float = 0
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    created_at: datetime

class UserUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_image: Optional[str] = None
    dance_categories: Optional[List[str]] = None
    is_available: Optional[bool] = None
    hourly_rate: Optional[float] = None

class DanceCategory(BaseModel):
    id: str
    name: str
    image_url: str

class PostCreate(BaseModel):
    type: str  # photo, video, text
    media: Optional[str] = None
    media_urls: Optional[List[str]] = None  # carousel: multiple media URLs
    caption: Optional[str] = ""
    thumbnail_url: Optional[str] = None  # custom thumbnail for video posts

class PostResponse(BaseModel):
    id: str
    user_id: str
    user: Optional[dict] = None
    type: str
    media: Optional[str] = None
    media_urls: List[str] = []
    thumbnail: Optional[str] = None
    caption: str = ""
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False
    recent_likers: List[dict] = []
    created_at: datetime

class CommentCreate(BaseModel):
    text: str

class CommentResponse(BaseModel):
    id: str
    user_id: str
    user: Optional[dict] = None
    post_id: str
    text: str
    created_at: datetime

class AvailabilitySlotCreate(BaseModel):
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    dance_categories: List[str]
    price: float

class AvailabilitySlotResponse(BaseModel):
    id: str
    user_id: str
    user: Optional[dict] = None
    date: str
    start_time: str
    end_time: str
    dance_categories: List[str]
    price: float
    is_booked: bool = False
    created_at: datetime

class BookingCreate(BaseModel):
    slot_id: str

class BookingResponse(BaseModel):
    id: str
    student_id: str
    teacher_id: str
    slot: Optional[dict] = None
    status: str  # pending, confirmed, completed, cancelled
    amount: float
    created_at: datetime

class LiveSessionRequest(BaseModel):
    teacher_id: str

# Video Lessons Models
class VideoLessonCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    price: float
    currency: str = "EUR"
    duration_minutes: int = 0

class VideoLessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    duration_minutes: Optional[int] = None

class VideoLessonResponse(BaseModel):
    id: str
    user_id: str
    user: Optional[dict] = None
    title: str
    description: str = ""
    price: float
    currency: str = "EUR"
    duration_minutes: int = 0
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    reviews_count: int = 0
    avg_rating: float = 0.0
    created_at: datetime

# Reviews
class ReviewCreate(BaseModel):
    rating: int
    text: str = ""

class ReviewResponse(BaseModel):
    id: str
    lesson_id: str
    user_id: str
    user: Optional[dict] = None
    rating: int
    text: str
    created_at: datetime

class LiveSessionRequest(BaseModel):
    teacher_id: str

class LiveSessionResponse(BaseModel):
    id: str
    student_id: str
    teacher_id: str
    teacher: Optional[dict] = None
    student: Optional[dict] = None
    status: str  # pending, accepted, active, completed, rejected
    amount: float
    room_url: Optional[str] = None
    room_name: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime

class ReviewCreate(BaseModel):
    session_id: str
    rating: int  # 1-5

class PreRecordedLessonCreate(BaseModel):
    title: str
    video: str  # base64
    duration: int  # minutes
    price: float
    dance_category: str

class PreRecordedLessonResponse(BaseModel):
    id: str
    user_id: str
    user: Optional[dict] = None
    title: str
    video: Optional[str] = None
    duration: int
    price: float
    dance_category: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Strip MongoDB _id to prevent ObjectId serialization issues
        user.pop("_id", None)
        
        # Update last_active timestamp (fire and forget)
        try:
            await db.users.update_one({"id": user_id}, {"$set": {"last_active": datetime.utcnow()}})
        except Exception:
            pass
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username exists
    existing = await db.users.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "username": data.username,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "bio": "",
        "profile_image": None,
        "dance_categories": [],
        "is_available": False,
        "hourly_rate": 50.0,
        "rating": 0,
        "followers_count": 0,
        "following_count": 0,
        "posts_count": 0,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user)
    token = create_token(user_id)
    
    user_response = UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    # Try login by email first, then by username
    user = await db.users.find_one({"email": data.email})
    if not user:
        user = await db.users.find_one({"username": data.email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    user.pop("_id", None)
    user_response = UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})
    return TokenResponse(access_token=token, user=user_response)

# ==================== USER ROUTES ====================

@api_router.get("/users/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**{k: v for k, v in current_user.items() if k != "password_hash"})

@api_router.put("/users/me", response_model=UserResponse)
async def update_me(data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if "username" in update_data:
        existing = await db.users.find_one({"username": update_data["username"], "id": {"$ne": current_user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user["id"]})
    return UserResponse(**{k: v for k, v in updated_user.items() if k != "password_hash"})

@api_router.get("/users/search")
async def search_users(q: str = "", current_user: dict = Depends(get_current_user)):
    if not q or len(q) < 1:
        return []
    
    # Build a fuzzy regex pattern that handles common typos
    # Allow each character to be optional or have one character difference
    def build_fuzzy_pattern(query: str) -> str:
        """Build a regex pattern that tolerates typos:
        - Missing characters
        - Extra characters  
        - Transposed characters
        - Wrong characters
        """
        pattern_parts = []
        for i, char in enumerate(query.lower()):
            if char.isalnum():
                # Allow this char to be missing or different
                # Also allow an extra char before this one
                pattern_parts.append(f".?{re.escape(char)}?")
            else:
                pattern_parts.append(re.escape(char))
        
        # Join and make it a partial match
        return ".*" + "".join(pattern_parts) + ".*"
    
    fuzzy_pattern = build_fuzzy_pattern(q)
    
    # First try exact/partial match (higher priority)
    exact_regex = {"$regex": q, "$options": "i"}
    exact_users = await db.users.find(
        {"$or": [{"username": exact_regex}, {"name": exact_regex}], "id": {"$ne": current_user["id"]}},
        {"_id": 0, "password_hash": 0, "password": 0}
    ).to_list(20)
    
    # If we have enough exact results, return them
    if len(exact_users) >= 5:
        return exact_users
    
    # Otherwise, also search with fuzzy pattern
    fuzzy_regex = {"$regex": fuzzy_pattern, "$options": "i"}
    fuzzy_users = await db.users.find(
        {"$or": [{"username": fuzzy_regex}, {"name": fuzzy_regex}], "id": {"$ne": current_user["id"]}},
        {"_id": 0, "password_hash": 0, "password": 0}
    ).to_list(20)
    
    # Combine results, prioritizing exact matches
    seen_ids = {u["id"] for u in exact_users}
    combined = exact_users[:]
    for u in fuzzy_users:
        if u["id"] not in seen_ids:
            combined.append(u)
            seen_ids.add(u["id"])
        if len(combined) >= 20:
            break
    
    return combined

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    
    if existing:
        # Unfollow
        await db.follows.delete_one({"id": existing["id"]})
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": -1}})
        await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": -1}})
        return {"following": False}
    else:
        # Follow
        follow = {
            "id": str(uuid.uuid4()),
            "follower_id": current_user["id"],
            "following_id": user_id,
            "created_at": datetime.utcnow()
        }
        await db.follows.insert_one(follow)
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": 1}})
        await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": 1}})
        return {"following": True}

@api_router.get("/users/{user_id}/is-following")
async def is_following(user_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    return {"following": existing is not None}

# ==================== DANCE CATEGORIES ====================

DEFAULT_CATEGORIES = [
    {"id": "latin", "name": "Latin American Dance", "image_url": "latin"},
    {"id": "ballroom", "name": "Ballroom", "image_url": "ballroom"},
    {"id": "breakdance", "name": "Break Dance", "image_url": "breakdance"},
    {"id": "classic", "name": "Classic", "image_url": "classic"},
    {"id": "modern", "name": "Modern", "image_url": "modern"},
    {"id": "caribbean", "name": "Caribbean", "image_url": "caribbean"},
    {"id": "hiphop", "name": "Hip Hop", "image_url": "hiphop"},
    {"id": "contemporary", "name": "Contemporary", "image_url": "contemporary"},
    {"id": "jazz", "name": "Jazz", "image_url": "jazz"},
    {"id": "pop", "name": "Pop", "image_url": "pop"},
]

@api_router.get("/dance-categories", response_model=List[DanceCategory])
async def get_dance_categories():
    return DEFAULT_CATEGORIES

# ==================== POSTS ROUTES ====================

@api_router.post("/posts", response_model=PostResponse)
async def create_post(data: PostCreate, current_user: dict = Depends(get_current_user)):
    post_id = str(uuid.uuid4())
    
    # Handle carousel (multiple media URLs)
    media_urls = []
    if data.media_urls:
        for url in data.media_urls:
            if url and not url.startswith('file://'):
                media_urls.append(url)
    
    # Handle single media (backward compat)
    media_url = None
    if data.media:
        if data.media.startswith('data:'):
            try:
                header, b64data = data.media.split(',', 1)
                ext = 'jpg' if 'jpeg' in header or 'jpg' in header else 'png'
                if 'video' in header:
                    ext = 'mp4'
                filename = f"{post_id}.{ext}"
                filepath = UPLOADS_DIR / filename
                import base64 as b64mod
                with open(filepath, 'wb') as f:
                    f.write(b64mod.b64decode(b64data))
                media_url = f"/api/uploads/{filename}"
            except Exception as e:
                logger.error(f"Failed to save media: {e}")
                media_url = data.media
        elif data.media.startswith('file://'):
            media_url = None
        else:
            media_url = data.media
    
    # If single media provided but no media_urls, put it in the array
    if media_url and not media_urls:
        media_urls = [media_url]
    # First item in media_urls is the primary media (backward compat)
    if media_urls and not media_url:
        media_url = media_urls[0]
    
    post = {
        "id": post_id,
        "user_id": current_user["id"],
        "type": data.type,
        "media": media_url,
        "media_urls": media_urls,
        "thumbnail": data.thumbnail_url,  # custom thumbnail if provided
        "caption": data.caption or "",
        "likes_count": 0,
        "comments_count": 0,
        "created_at": datetime.utcnow()
    }
    
    await db.posts.insert_one(post)
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"posts_count": 1}})
    
    post["user"] = {
        "id": current_user["id"],
        "username": current_user["username"],
        "name": current_user["name"],
        "profile_image": current_user.get("profile_image")
    }
    post["is_liked"] = False
    
    return PostResponse(**post)

# Helper to convert video file paths to base64 data URLs for browser playback
def resolve_media_to_data_url(media_path: str | None) -> str | None:
    """For videos stored as /api/uploads/xxx.mp4, convert to data:video/mp4;base64,..."""
    if not media_path:
        return None
    if media_path.startswith('data:') or media_path.startswith('http'):
        return media_path  # Already a data URL or external URL
    if not media_path.startswith('/api/uploads/'):
        return media_path  # Not a server path
    
    filename = media_path.replace('/api/uploads/', '')
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        return None
    
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    
    # Only convert videos to data URLs (images work fine as file URLs)
    if ext in ['mp4', 'mov', 'webm']:
        try:
            with open(filepath, 'rb') as f:
                data = f.read()
            mime = 'video/mp4' if ext == 'mp4' else f'video/{ext}'
            return f"data:{mime};base64,{base64.b64encode(data).decode()}"
        except Exception as e:
            logger.error(f"Failed to convert video to data URL: {e}")
            return media_path
    
    return media_path  # Return path as-is for images

@api_router.get("/posts", response_model=List[PostResponse])
async def get_posts(current_user: dict = Depends(get_current_user)):
    # Get all posts, sorted by newest first (small community app)
    posts = await db.posts.find().sort("created_at", -1).to_list(100)
    
    # Get likes for current user
    user_likes = await db.likes.find({"user_id": current_user["id"]}).to_list(1000)
    liked_post_ids = {l["post_id"] for l in user_likes}
    
    result = []
    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]})
        if user:
            post["user"] = {
                "id": user["id"],
                "username": user["username"],
                "name": user["name"],
                "profile_image": user.get("profile_image")
            }
        post["is_liked"] = post["id"] in liked_post_ids
        # Ensure media_urls backward compat
        if "media_urls" not in post or not post["media_urls"]:
            post["media_urls"] = [post["media"]] if post.get("media") else []
        # Get recent likers (up to 5)
        if post.get("likes_count", 0) > 0:
            recent_likes = await db.likes.find({"post_id": post["id"]}).sort("created_at", -1).to_list(5)
            likers = []
            for lk in recent_likes:
                liker = await db.users.find_one({"id": lk["user_id"]}, {"_id": 0, "id": 1, "username": 1, "profile_image": 1})
                if liker:
                    likers.append(liker)
            post["recent_likers"] = likers
        else:
            post["recent_likers"] = []
        result.append(PostResponse(**post))
    
    return result


@api_router.get("/users/{user_id}/posts", response_model=List[PostResponse])
async def get_user_posts(user_id: str, current_user: dict = Depends(get_current_user)):
    posts = await db.posts.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    user = await db.users.find_one({"id": user_id})
    user_likes = await db.likes.find({"user_id": current_user["id"]}).to_list(1000)
    liked_post_ids = {l["post_id"] for l in user_likes}
    result = []
    for post in posts:
        if user:
            post["user"] = {
                "id": user["id"],
                "username": user["username"],
                "name": user["name"],
                "profile_image": user.get("profile_image")
            }
        post["is_liked"] = post["id"] in liked_post_ids
        if "media_urls" not in post or not post["media_urls"]:
            post["media_urls"] = [post["media"]] if post.get("media") else []
        result.append(PostResponse(**post))
    return result

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.likes.find_one({
        "user_id": current_user["id"],
        "post_id": post_id
    })
    
    if existing:
        # Unlike
        await db.likes.delete_one({"id": existing["id"]})
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
        return {"liked": False}
    else:
        # Like
        like = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "post_id": post_id,
            "created_at": datetime.utcnow()
        }
        await db.likes.insert_one(like)
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        return {"liked": True}

@api_router.post("/posts/{post_id}/save")
async def toggle_save_post(post_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.saved_posts.find_one({"post_id": post_id, "user_id": current_user["id"]})
    if existing:
        await db.saved_posts.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    else:
        await db.saved_posts.insert_one({"post_id": post_id, "user_id": current_user["id"], "created_at": datetime.utcnow()})
        return {"saved": True}

@api_router.get("/posts/saved")
async def get_saved_posts(current_user: dict = Depends(get_current_user)):
    saved = await db.saved_posts.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    post_ids = [s["post_id"] for s in saved]
    posts = await db.posts.find({"id": {"$in": post_ids}}, {"_id": 0}).to_list(100)
    for p in posts:
        user = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "id": 1, "username": 1, "name": 1, "profile_image": 1})
        p["user"] = user or {}
        p["is_liked"] = False
        p["recent_likers"] = []
    return [PostResponse(**p) for p in posts]

@api_router.get("/posts/{post_id}/likers")
async def get_post_likers(post_id: str, limit: int = 5, current_user: dict = Depends(get_current_user)):
    """Get recent likers for a post with their profile info."""
    likes = await db.likes.find({"post_id": post_id}).sort("created_at", -1).to_list(limit)
    likers = []
    for like in likes:
        user = await db.users.find_one({"id": like["user_id"]}, {"_id": 0, "id": 1, "username": 1, "profile_image": 1})
        if user:
            likers.append(user)
    return likers

@api_router.get("/posts/{post_id}", response_model=PostResponse)
async def get_single_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    user = await db.users.find_one({"id": post["user_id"]})
    if user:
        post["user"] = {"id": user["id"], "username": user["username"], "name": user["name"], "profile_image": user.get("profile_image")}
    # Check if liked
    existing_like = await db.likes.find_one({"user_id": current_user["id"], "post_id": post_id})
    post["is_liked"] = existing_like is not None
    # Get recent likers
    if post.get("likes_count", 0) > 0:
        recent_likes = await db.likes.find({"post_id": post_id}).sort("created_at", -1).to_list(5)
        likers = []
        for lk in recent_likes:
            liker = await db.users.find_one({"id": lk["user_id"]}, {"_id": 0, "id": 1, "username": 1, "profile_image": 1})
            if liker:
                likers.append(liker)
        post["recent_likers"] = likers
    else:
        post["recent_likers"] = []
    post.pop("_id", None)
    if "media_urls" not in post or not post["media_urls"]:
        post["media_urls"] = [post["media"]] if post.get("media") else []
    return PostResponse(**post)

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.posts.delete_one({"id": post_id})
    await db.likes.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    await db.saved_posts.delete_many({"post_id": post_id})
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"posts_count": -1}})
    return {"status": "deleted"}



@api_router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(post_id: str, data: CommentCreate, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment_id = str(uuid.uuid4())
    comment = {
        "id": comment_id,
        "user_id": current_user["id"],
        "post_id": post_id,
        "text": data.text,
        "created_at": datetime.utcnow()
    }
    
    await db.comments.insert_one(comment)
    await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    
    comment["user"] = {
        "id": current_user["id"],
        "username": current_user["username"],
        "name": current_user["name"],
        "profile_image": current_user.get("profile_image")
    }
    
    return CommentResponse(**comment)

@api_router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_comments(post_id: str, current_user: dict = Depends(get_current_user)):
    comments = await db.comments.find({"post_id": post_id}).sort("created_at", -1).to_list(100)
    
    result = []
    for comment in comments:
        user = await db.users.find_one({"id": comment["user_id"]})
        if user:
            comment["user"] = {
                "id": user["id"],
                "username": user["username"],
                "name": user["name"],
                "profile_image": user.get("profile_image")
            }
        result.append(CommentResponse(**comment))
    
    return result


# ==================== STORIES ====================

class StoryCreate(BaseModel):
    media: str  # base64
    type: str = "photo"  # photo or video

class StoryResponse(BaseModel):
    id: str
    user_id: str
    user: Optional[dict] = None
    media: str
    thumbnail: Optional[str] = None
    type: str
    views_count: int = 0
    created_at: datetime
    expires_at: datetime

@api_router.post("/stories", response_model=StoryResponse)
async def create_story(data: StoryCreate, current_user: dict = Depends(get_current_user)):
    story_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    # Convert base64 media to file if needed
    media_value = data.media
    if data.media and data.media.startswith('data:'):
        try:
            header, b64data = data.media.split(',', 1)
            ext = 'jpg'
            if 'video' in header:
                ext = 'mp4'
            elif 'png' in header:
                ext = 'png'
            filename = f"story_{story_id}.{ext}"
            filepath = UPLOADS_DIR / filename
            import base64 as b64mod
            with open(filepath, 'wb') as f:
                f.write(b64mod.b64decode(b64data))
            media_value = f"/api/uploads/{filename}"
        except Exception as e:
            logger.error(f"Failed to save story media: {e}")
    
    story = {
        "id": story_id,
        "user_id": current_user["id"],
        "media": media_value,
        "thumbnail": None,
        "type": data.type,
        "views_count": 0,
        "created_at": now,
        "expires_at": now + timedelta(hours=24)
    }
    
    # Generate thumbnail for video stories
    if data.type == "video" and media_value and media_value.startswith("/api/uploads/"):
        try:
            video_filename = media_value.replace("/api/uploads/", "")
            video_path = UPLOADS_DIR / video_filename
            thumb_filename = f"thumb_{story_id}.jpg"
            thumb_path = UPLOADS_DIR / thumb_filename
            import subprocess
            subprocess.run([
                "ffmpeg", "-i", str(video_path), "-ss", "0.5", "-vframes", "1",
                "-vf", "scale=480:-1", str(thumb_path)
            ], capture_output=True, timeout=10)
            if thumb_path.exists():
                story["thumbnail"] = f"/api/uploads/{thumb_filename}"
        except Exception as e:
            logger.error(f"Story thumbnail generation failed: {e}")
    
    await db.stories.insert_one(story)
    
    story["user"] = {
        "id": current_user["id"],
        "username": current_user["username"],
        "name": current_user["name"],
        "profile_image": current_user.get("profile_image")
    }
    
    return StoryResponse(**story)

@api_router.get("/stories", response_model=List[dict])
async def get_stories(current_user: dict = Depends(get_current_user)):
    # Get non-expired stories from all users
    now = datetime.utcnow()
    stories = await db.stories.find({
        "expires_at": {"$gt": now}
    }).sort("created_at", -1).to_list(100)
    
    # Group by user
    user_stories = {}
    for story in stories:
        user_id = story["user_id"]
        if user_id not in user_stories:
            user = await db.users.find_one({"id": user_id})
            user_stories[user_id] = {
                "user_id": user_id,
                "username": user["username"] if user else "unknown",
                "profile_image": user.get("profile_image") if user else None,
                "stories": [],
                "has_unread": True  # Simplified for now
            }
        user_stories[user_id]["stories"].append({
            "id": story["id"],
            "media": story["media"],
            "thumbnail": story.get("thumbnail"),
            "type": story["type"],
            "created_at": story["created_at"].isoformat()
        })
    
    return list(user_stories.values())

@api_router.get("/stories/{story_id}")
async def get_story(story_id: str, current_user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Increment view count
    await db.stories.update_one({"id": story_id}, {"$inc": {"views_count": 1}})
    
    user = await db.users.find_one({"id": story["user_id"]})
    
    # Remove MongoDB _id field
    story.pop("_id", None)
    
    story["user"] = {
        "id": user["id"],
        "username": user["username"],
        "name": user["name"],
        "profile_image": user.get("profile_image")
    }
    
    return story



# ==================== AVAILABILITY & BOOKINGS ====================

@api_router.get("/available-teachers", response_model=List[dict])
async def get_available_teachers(current_user: dict = Depends(get_current_user)):
    user_categories = current_user.get("dance_categories", [])
    
    # Auto-close stale "active" sessions older than 2 hours
    two_hours_ago = datetime.utcnow() - timedelta(hours=2)
    await db.live_sessions.update_many(
        {"status": "active", "created_at": {"$lt": two_hours_ago}},
        {"$set": {"status": "completed", "ended_at": datetime.utcnow()}}
    )
    
    # Show ALL users (not just available), mark online status
    fifteen_min_ago = datetime.utcnow() - timedelta(minutes=15)
    query = {"id": {"$ne": current_user["id"]}}
    if user_categories:
        query["dance_categories"] = {"$in": user_categories}
    if user_categories:
        query["dance_categories"] = {"$in": user_categories}
    
    users = await db.users.find(query).to_list(100)
    
    # Get active sessions to know who's currently in a call
    active_sessions = await db.live_sessions.find({"status": "active"}).to_list(100)
    busy_user_ids = {}
    for sess in active_sessions:
        start = sess.get("started_at") or sess.get("created_at", datetime.utcnow())
        elapsed_minutes = (datetime.utcnow() - start).total_seconds() / 60
        remaining = max(0, int(60 - elapsed_minutes))
        if sess.get("teacher_id"):
            busy_user_ids[sess["teacher_id"]] = remaining
        if sess.get("student_id"):
            busy_user_ids[sess["student_id"]] = remaining
    
    result = []
    for user in users:
        uid = user["id"]
        is_busy = uid in busy_user_ids
        is_recently_active = user.get("last_active") and user["last_active"] >= fifteen_min_ago
        is_set_available = user.get("is_available", False)
        is_online = is_set_available and is_recently_active and not is_busy
        
        # Get average rating from reviews collection
        avg_rating_result = await db.reviews.aggregate([
            {"$match": {"reviewee_id": uid, "rating": {"$exists": True, "$gt": 0}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        avg_rating = avg_rating_result[0]["avg"] if avg_rating_result else 0
        review_count = avg_rating_result[0]["count"] if avg_rating_result else 0
        
        result.append({
            "id": uid,
            "username": user["username"],
            "name": user.get("name", user["username"]),
            "profile_image": user.get("profile_image"),
            "rating": round(avg_rating, 1),
            "review_count": review_count,
            "hourly_rate": user.get("hourly_rate", 50),
            "dance_categories": user.get("dance_categories", []),
            "is_available": is_online,
            "is_busy": is_busy,
            "remaining_minutes": busy_user_ids.get(uid, 0) if is_busy else 0,
        })
    
    # Sort: online first, then busy, then offline
    result.sort(key=lambda x: (not x["is_available"], x["is_busy"], -(x["rating"] or 0)))
    return result

@api_router.post("/availability-slots", response_model=AvailabilitySlotResponse)
async def create_availability_slot(data: AvailabilitySlotCreate, current_user: dict = Depends(get_current_user)):
    slot_id = str(uuid.uuid4())
    slot = {
        "id": slot_id,
        "user_id": current_user["id"],
        "date": data.date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "dance_categories": data.dance_categories,
        "price": data.price,
        "is_booked": False,
        "created_at": datetime.utcnow()
    }
    
    await db.availability_slots.insert_one(slot)
    
    slot["user"] = {
        "id": current_user["id"],
        "username": current_user["username"],
        "name": current_user["name"],
        "profile_image": current_user.get("profile_image")
    }
    
    return AvailabilitySlotResponse(**slot)

@api_router.get("/availability-slots", response_model=List[AvailabilitySlotResponse])
async def get_my_availability_slots(current_user: dict = Depends(get_current_user)):
    slots = await db.availability_slots.find({"user_id": current_user["id"]}).sort("date", 1).to_list(100)
    
    result = []
    for slot in slots:
        slot["user"] = {
            "id": current_user["id"],
            "username": current_user["username"],
            "name": current_user["name"],
            "profile_image": current_user.get("profile_image")
        }
        result.append(AvailabilitySlotResponse(**slot))
    
    return result

@api_router.get("/users/{user_id}/availability-slots", response_model=List[AvailabilitySlotResponse])
async def get_user_availability_slots(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    slots = await db.availability_slots.find({
        "user_id": user_id,
        "is_booked": False,
        "date": {"$gte": today}
    }).sort("date", 1).to_list(100)
    
    result = []
    for slot in slots:
        slot["user"] = {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "profile_image": user.get("profile_image")
        }
        result.append(AvailabilitySlotResponse(**slot))
    
    return result

@api_router.post("/bookings", response_model=BookingResponse)
async def create_booking(data: BookingCreate, current_user: dict = Depends(get_current_user)):
    slot = await db.availability_slots.find_one({"id": data.slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    if slot["is_booked"]:
        raise HTTPException(status_code=400, detail="Slot already booked")
    
    if slot["user_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot book your own slot")
    
    booking_id = str(uuid.uuid4())
    booking = {
        "id": booking_id,
        "student_id": current_user["id"],
        "teacher_id": slot["user_id"],
        "slot_id": data.slot_id,
        "status": "confirmed",
        "amount": slot["price"],
        "created_at": datetime.utcnow()
    }
    
    await db.bookings.insert_one(booking)
    await db.availability_slots.update_one({"id": data.slot_id}, {"$set": {"is_booked": True}})
    
    # Clean slot data to remove MongoDB ObjectIDs that can't be serialized
    clean_slot = {k: v for k, v in slot.items() if k != "_id"}
    booking["slot"] = clean_slot
    
    return BookingResponse(**booking)

@api_router.get("/bookings", response_model=List[BookingResponse])
async def get_my_bookings(current_user: dict = Depends(get_current_user)):
    bookings = await db.bookings.find({
        "$or": [
            {"student_id": current_user["id"]},
            {"teacher_id": current_user["id"]}
        ]
    }).sort("created_at", -1).to_list(100)
    
    result = []
    for booking in bookings:
        slot = await db.availability_slots.find_one({"id": booking["slot_id"]})
        # Clean slot data to remove MongoDB ObjectIDs that can't be serialized
        clean_slot = {k: v for k, v in slot.items() if k != "_id"} if slot else None
        booking["slot"] = clean_slot
        result.append(BookingResponse(**booking))
    
    return result

# ==================== LIVE SESSIONS ====================

@api_router.post("/live-sessions/request", response_model=LiveSessionResponse)
async def request_live_session(data: LiveSessionRequest, current_user: dict = Depends(get_current_user)):
    teacher = await db.users.find_one({"id": data.teacher_id})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    if not teacher.get("is_available"):
        raise HTTPException(status_code=400, detail="Teacher is not available")
    
    if data.teacher_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot request session with yourself")
    
    session_id = str(uuid.uuid4())
    session = {
        "id": session_id,
        "student_id": current_user["id"],
        "teacher_id": data.teacher_id,
        "status": "pending",
        "amount": teacher.get("hourly_rate", 50),
        "started_at": None,
        "ended_at": None,
        "created_at": datetime.utcnow()
    }
    
    await db.live_sessions.insert_one(session)
    
    session["teacher"] = {
        "id": teacher["id"],
        "username": teacher["username"],
        "name": teacher["name"],
        "profile_image": teacher.get("profile_image")
    }
    
    return LiveSessionResponse(**session)

@api_router.get("/live-sessions/pending", response_model=List[LiveSessionResponse])
async def get_pending_sessions(current_user: dict = Depends(get_current_user)):
    sessions = await db.live_sessions.find({
        "teacher_id": current_user["id"],
        "status": "pending"
    }).to_list(100)
    
    result = []
    for session in sessions:
        student = await db.users.find_one({"id": session["student_id"]})
        session["student"] = {
            "id": student["id"],
            "username": student["username"],
            "name": student["name"],
            "profile_image": student.get("profile_image")
        } if student else None
        session["teacher"] = {
            "id": current_user["id"],
            "username": current_user["username"],
            "name": current_user["name"],
            "profile_image": current_user.get("profile_image")
        }
        result.append(LiveSessionResponse(**session))
    
    return result

@api_router.get("/live-sessions/pending/count")
async def get_pending_count(current_user: dict = Depends(get_current_user)):
    count = await db.live_sessions.count_documents({
        "teacher_id": current_user["id"],
        "status": "pending"
    })
    return {"count": count}


@api_router.post("/live-sessions/{session_id}/accept", response_model=LiveSessionResponse)
async def accept_live_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.live_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create Daily.co room for the video call
    room_url = None
    room_name = None
    if DAILY_API_KEY:
        try:
            room_name = f"beatmates-{uuid.uuid4().hex[:12]}"
            exp_timestamp = int((datetime.utcnow() + timedelta(hours=2)).timestamp())
            async with httpx.AsyncClient() as client_http:
                response = await client_http.post(
                    f"{DAILY_API_URL}/rooms",
                    headers={"Authorization": f"Bearer {DAILY_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "name": room_name,
                        "privacy": "public",
                        "properties": {"exp": exp_timestamp, "enable_chat": True, "max_participants": 2}
                    }
                )
                if response.status_code == 200:
                    room_data = response.json()
                    room_url = room_data["url"]
                else:
                    logger.error(f"Daily.co room creation failed: {response.text}")
        except Exception as e:
            logger.error(f"Daily.co error: {e}")
    
    await db.live_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": "active",
            "started_at": datetime.utcnow(),
            "room_url": room_url,
            "room_name": room_name,
        }}
    )
    
    session = await db.live_sessions.find_one({"id": session_id})
    teacher = await db.users.find_one({"id": session["teacher_id"]})
    session["teacher"] = {
        "id": teacher["id"],
        "username": teacher["username"],
        "name": teacher["name"],
        "profile_image": teacher.get("profile_image")
    }
    
    return LiveSessionResponse(**clean_doc(session))

@api_router.post("/live-sessions/{session_id}/reject")
async def reject_live_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.live_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.live_sessions.update_one({"id": session_id}, {"$set": {"status": "rejected"}})
    return {"status": "rejected"}

@api_router.post("/live-sessions/{session_id}/end")
async def end_live_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.live_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["teacher_id"] != current_user["id"] and session["student_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.live_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "completed", "ended_at": datetime.utcnow()}}
    )
    return {"status": "completed"}

# ==================== COACHING REVIEW TOOL ====================

class CoachingCommand(BaseModel):
    action: str  # "seek", "speed", "play", "pause", "draw", "clear_drawings"
    value: Optional[str] = None  # seek time, speed value, or drawing SVG path data

@api_router.post("/coaching/{session_id}/upload")
async def upload_coaching_clip(session_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload a 20-second coaching clip during a live session."""
    session = await db.live_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    filename = f"coaching_{session_id}_{uuid.uuid4().hex[:8]}.mp4"
    filepath = UPLOADS_DIR / filename
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Compress for web compatibility (run in thread to avoid blocking event loop)
    import asyncio
    compressed = await asyncio.to_thread(compress_video, str(filepath))
    media_url = f"/api/uploads/{compressed}"
    
    # Generate poster thumbnail from first frame
    poster_name = f"poster_{compressed.replace('.mp4', '.jpg')}"
    poster_path = UPLOADS_DIR / poster_name
    try:
        await asyncio.to_thread(
            lambda: subprocess.run(
                ["ffmpeg", "-i", str(UPLOADS_DIR / compressed), "-vframes", "1", "-an", "-ss", "0.01", "-update", "1", str(poster_path), "-y"],
                capture_output=True, timeout=15
            )
        )
    except Exception as e:
        logger.warning(f"Poster generation failed: {e}")
    
    poster_url = f"/api/uploads/{poster_name}" if poster_path.exists() else None
    
    # Store coaching state
    await db.coaching_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "session_id": session_id,
            "video_url": media_url,
            "poster_url": poster_url,
            "current_time": 0,
            "speed": 1.0,
            "is_playing": False,
            "drawings": [],
            "updated_at": datetime.utcnow().isoformat(),
        }},
        upsert=True
    )
    return {"video_url": media_url}

@api_router.post("/coaching/{session_id}/command")
async def send_coaching_command(session_id: str, cmd: CoachingCommand, current_user: dict = Depends(get_current_user)):
    """Both users can send playback/drawing commands."""
    update = {"updated_at": datetime.utcnow().isoformat()}
    if cmd.action == "seek":
        update["current_time"] = float(cmd.value or 0)
    elif cmd.action == "speed":
        update["speed"] = float(cmd.value or 1)
    elif cmd.action == "play":
        update["is_playing"] = True
    elif cmd.action == "pause":
        update["is_playing"] = False
    elif cmd.action == "start_coaching":
        update["coaching_active"] = True
    elif cmd.action == "stop_coaching":
        update["coaching_active"] = False
    elif cmd.action == "reset_coaching":
        update["video_url"] = None
        update["current_time"] = 0
        update["speed"] = 1.0
        update["is_playing"] = False
        update["drawings"] = []
    elif cmd.action == "draw":
        await db.coaching_sessions.update_one(
            {"session_id": session_id},
            {"$push": {"drawings": cmd.value}, "$set": {"updated_at": datetime.utcnow().isoformat()}},
            upsert=True
        )
        return {"ok": True}
    elif cmd.action == "clear_drawings":
        update["drawings"] = []
    elif cmd.action == "start_uploading":
        update["uploading_by"] = current_user.get("username", "Utente")
    elif cmd.action == "stop_uploading":
        update["uploading_by"] = None
    
    await db.coaching_sessions.update_one(
        {"session_id": session_id},
        {"$set": update},
        upsert=True
    )
    return {"ok": True}

@api_router.get("/coaching/{session_id}/state")
async def get_coaching_state(session_id: str, current_user: dict = Depends(get_current_user)):
    """Student polls this to sync with teacher's controls."""
    state = await db.coaching_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not state:
        return {"session_id": session_id, "video_url": None}
    return state

# ==================== END COACHING ====================

@api_router.get("/live-sessions/{session_id}", response_model=LiveSessionResponse)
async def get_live_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.live_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    teacher = await db.users.find_one({"id": session["teacher_id"]})
    session["teacher"] = {
        "id": teacher["id"],
        "username": teacher["username"],
        "name": teacher["name"],
        "profile_image": teacher.get("profile_image")
    }
    
    return LiveSessionResponse(**clean_doc(session))

# Quick review endpoint for live sessions (after call ends)
class LiveSessionReview(BaseModel):
    rating: int
    text: str = ""

@api_router.post("/live-sessions/{session_id}/review")
async def review_live_session(session_id: str, data: LiveSessionReview, current_user: dict = Depends(get_current_user)):
    session = await db.live_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if user was part of this session
    if session["student_id"] != current_user["id"] and session["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You were not part of this session")
    
    # Determine who is being reviewed
    if session["student_id"] == current_user["id"]:
        reviewee_id = session["teacher_id"]
    else:
        reviewee_id = session["student_id"]
    
    # Check for existing review
    existing = await db.reviews.find_one({
        "session_id": session_id,
        "reviewer_id": current_user["id"]
    })
    
    if existing:
        # Update existing review
        await db.reviews.update_one(
            {"id": existing["id"]},
            {"$set": {"rating": data.rating, "text": data.text}}
        )
        return {"message": "Review updated", "id": existing["id"]}
    
    # Create new review
    review = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "reviewer_id": current_user["id"],
        "reviewee_id": reviewee_id,
        "rating": data.rating,
        "text": data.text,
        "created_at": datetime.utcnow()
    }
    
    await db.reviews.insert_one(review)
    
    # Update teacher's average rating
    teacher_reviews = await db.reviews.find({"reviewee_id": reviewee_id}).to_list(1000)
    if teacher_reviews:
        avg_rating = sum(r["rating"] for r in teacher_reviews) / len(teacher_reviews)
        await db.users.update_one(
            {"id": reviewee_id},
            {"$set": {"average_rating": round(avg_rating, 1), "reviews_count": len(teacher_reviews)}}
        )
    
    return {"message": "Review created", "id": review["id"]}

# ==================== REVIEWS ====================

@api_router.post("/reviews")
async def create_review(data: ReviewCreate, current_user: dict = Depends(get_current_user)):
    session = await db.live_sessions.find_one({"id": data.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["student_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only students can review")
    
    existing = await db.reviews.find_one({
        "session_id": data.session_id,
        "reviewer_id": current_user["id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed")
    
    review = {
        "id": str(uuid.uuid4()),
        "session_id": data.session_id,
        "reviewer_id": current_user["id"],
        "reviewee_id": session["teacher_id"],
        "rating": data.rating,
        "created_at": datetime.utcnow()
    }
    
    await db.reviews.insert_one(review)
    
    # Update teacher's average rating
    reviews = await db.reviews.find({"reviewee_id": session["teacher_id"]}).to_list(1000)
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0
    await db.users.update_one({"id": session["teacher_id"]}, {"$set": {"rating": avg_rating}})
    
    return {"success": True}

# ==================== PRE-RECORDED LESSONS ====================

@api_router.post("/pre-recorded-lessons", response_model=PreRecordedLessonResponse)
async def create_pre_recorded_lesson(data: PreRecordedLessonCreate, current_user: dict = Depends(get_current_user)):
    lesson_id = str(uuid.uuid4())
    lesson = {
        "id": lesson_id,
        "user_id": current_user["id"],
        "title": data.title,
        "video": data.video,
        "duration": data.duration,
        "price": data.price,
        "dance_category": data.dance_category,
        "created_at": datetime.utcnow()
    }
    
    await db.pre_recorded_lessons.insert_one(lesson)
    
    lesson["user"] = {
        "id": current_user["id"],
        "username": current_user["username"],
        "name": current_user["name"],
        "profile_image": current_user.get("profile_image")
    }
    
    return PreRecordedLessonResponse(**lesson)

@api_router.get("/users/{user_id}/pre-recorded-lessons", response_model=List[PreRecordedLessonResponse])
async def get_user_pre_recorded_lessons(user_id: str, current_user: dict = Depends(get_current_user)):
    lessons = await db.pre_recorded_lessons.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    
    user = await db.users.find_one({"id": user_id})
    
    result = []
    for lesson in lessons:
        lesson["user"] = {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "profile_image": user.get("profile_image")
        }
        # Don't include video in list view
        lesson["video"] = None
        result.append(PreRecordedLessonResponse(**lesson))
    
    return result

# ==================== TOGGLE AVAILABILITY ====================

@api_router.post("/users/me/toggle-availability")
async def toggle_availability(current_user: dict = Depends(get_current_user)):
    new_status = not current_user.get("is_available", False)
    update_data = {"is_available": new_status}
    
    if new_status:
        update_data["available_since"] = datetime.utcnow()
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    return {"is_available": new_status}

# ==================== FILE UPLOAD ====================

import subprocess

def generate_video_thumbnail(video_path: str, thumb_path: str) -> bool:
    """Extract first frame from video as JPEG thumbnail."""
    try:
        cmd = [
            'ffmpeg', '-y', '-i', video_path,
            '-vframes', '1', '-q:v', '3',
            '-vf', 'scale=320:-1',
            thumb_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=15)
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return False

def convert_video_to_mp4(input_path: str, output_path: str) -> bool:
    """Convert any video to web-compatible H.264 8-bit MP4 format."""
    try:
        cmd = [
            'ffmpeg', '-y', '-i', input_path,
            '-c:v', 'libx264', '-profile:v', 'main', '-level', '4.0',
            '-pix_fmt', 'yuv420p',  # Force 8-bit for web compatibility
            '-preset', 'fast', '-crf', '23',
            '-c:a', 'aac', '-b:a', '64k',
            '-movflags', '+faststart',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        if result.returncode != 0:
            logger.warning(f"Video conversion failed: {result.stderr[:500] if result.stderr else 'unknown'}")
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Video conversion failed: {e}")
        return False

def compress_video(input_path: str) -> str:
    """ALWAYS re-encode video to web-compatible H.264 8-bit Main profile."""
    try:
        file_size = os.path.getsize(input_path)
        base = os.path.splitext(input_path)[0]
        output_path = f"{base}_web.mp4"
        
        # Use CRF based on file size for quality/size balance
        crf = '28' if file_size > 3 * 1024 * 1024 else '23'
        
        cmd = [
            'ffmpeg', '-y', '-i', input_path,
            '-c:v', 'libx264', '-profile:v', 'main', '-level', '4.0',
            '-pix_fmt', 'yuv420p',  # Force 8-bit for web compatibility
            '-preset', 'fast', '-crf', crf,
            '-c:a', 'aac', '-b:a', '64k',
            '-movflags', '+faststart',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',  # Ensure even dimensions
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=180)
        
        if result.returncode == 0 and os.path.exists(output_path):
            os.remove(input_path)
            new_name = os.path.basename(input_path)
            new_path = os.path.join(os.path.dirname(output_path), new_name)
            os.rename(output_path, new_path)
            logger.info(f"Re-encoded video from {file_size//1024}KB to {os.path.getsize(new_path)//1024}KB (web-compatible H.264 8-bit)")
            return new_name
        logger.warning(f"Video re-encode failed (returncode={result.returncode}), keeping original. stderr: {result.stderr[:500] if result.stderr else 'none'}")
        return os.path.basename(input_path)
    except Exception as e:
        logger.error(f"Video compression failed: {e}")
        return os.path.basename(input_path)

@api_router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Determine extension from filename or content type
    ext = 'jpg'
    if file.filename:
        parts = file.filename.rsplit('.', 1)
        if len(parts) > 1:
            ext = parts[1].lower()
    
    is_video = False
    if file.content_type:
        if 'video' in file.content_type:
            is_video = True
            if ext not in ['mp4', 'mov', 'avi', 'webm']:
                ext = 'mp4'
        elif 'png' in file.content_type:
            ext = 'png'
        elif 'gif' in file.content_type:
            ext = 'gif'
        elif 'webp' in file.content_type:
            ext = 'webp'

    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{ext}"
    filepath = UPLOADS_DIR / filename

    content = await file.read()
    with open(filepath, 'wb') as f:
        f.write(content)

    # Convert video to H.264 MP4 for browser compatibility
    if is_video and ext != 'mp4':
        mp4_filename = f"{file_id}.mp4"
        mp4_path = UPLOADS_DIR / mp4_filename
        if convert_video_to_mp4(str(filepath), str(mp4_path)):
            os.remove(filepath)
            filename = mp4_filename
            filepath = mp4_path
    elif is_video:
        # ALWAYS compress MP4 videos for fast loading (run in thread to not block event loop)
        import asyncio
        compressed_filename = await asyncio.to_thread(compress_video, str(filepath))
        filename = compressed_filename
        filepath = UPLOADS_DIR / filename

    url = f"/api/uploads/{filename}"
    media_type = "video" if is_video else "image"
    
    # Generate thumbnail for videos
    thumbnail_url = None
    if is_video:
        thumb_filename = f"{file_id}_thumb.jpg"
        thumb_path = UPLOADS_DIR / thumb_filename
        final_video_path = UPLOADS_DIR / filename
        if generate_video_thumbnail(str(final_video_path), str(thumb_path)):
            thumbnail_url = f"/api/uploads/{thumb_filename}"
    
    return {"url": url, "filename": filename, "media_type": media_type, "thumbnail": thumbnail_url}

# Video streaming endpoint - returns base64 data URL for short videos
@api_router.api_route("/media/{filename}", methods=["GET", "HEAD"])
async def stream_media(filename: str, request: Request):
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    content_types = {
        'mp4': 'video/mp4', 'mov': 'video/quicktime', 'webm': 'video/webm',
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'aac': 'audio/aac',
        'm4a': 'audio/mp4', 'ogg': 'audio/ogg',
    }
    media_type = content_types.get(ext, 'application/octet-stream')
    file_size = filepath.stat().st_size
    
    # Handle Range requests (required for iOS audio/video streaming)
    range_header = request.headers.get('range')
    if range_header and request.method == "GET":
        try:
            range_spec = range_header.replace('bytes=', '')
            parts = range_spec.split('-')
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else file_size - 1
            end = min(end, file_size - 1)
            content_length = end - start + 1
            
            def iter_file():
                with open(filepath, 'rb') as f:
                    f.seek(start)
                    remaining = content_length
                    while remaining > 0:
                        chunk = f.read(min(8192, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk
            
            return StreamingResponse(
                iter_file(),
                status_code=206,
                media_type=media_type,
                headers={
                    'Content-Range': f'bytes {start}-{end}/{file_size}',
                    'Content-Length': str(content_length),
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=3600',
                }
            )
        except Exception:
            pass  # Fall through to normal response
    
    # HEAD request or normal GET
    if request.method == "HEAD":
        return Response(
            content=b'',
            media_type=media_type,
            headers={
                'Content-Length': str(file_size),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=3600',
            }
        )
    
    return FileResponse(
        path=str(filepath),
        media_type=media_type,
        headers={
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'Content-Length': str(file_size),
        }
    )

@api_router.get("/thumbnail/{filename}")
async def get_video_thumbnail(filename: str):
    """Generate and return a thumbnail for a video file (on-the-fly with caching)."""
    # Strip extension and add _thumb.jpg
    base_name = filename.rsplit('.', 1)[0] if '.' in filename else filename
    thumb_filename = f"{base_name}_thumb.jpg"
    thumb_path = UPLOADS_DIR / thumb_filename
    
    # Return cached thumbnail if it exists
    if thumb_path.exists():
        return FileResponse(path=str(thumb_path), media_type='image/jpeg')
    
    # Generate from video
    video_path = UPLOADS_DIR / filename
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    
    if generate_video_thumbnail(str(video_path), str(thumb_path)):
        return FileResponse(path=str(thumb_path), media_type='image/jpeg')
    
    raise HTTPException(status_code=500, detail="Failed to generate thumbnail")

@api_router.get("/video-player/{filename}")
async def video_player_page(filename: str, controls: str = "0", muted: str = "1", autoplay: str = "1", fit: str = "cover", loop: str = "1", poster: str = ""):
    """Serve an HTML page with a video player for the given filename."""
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    ctrl = "controls" if controls == "1" else ""
    mt = "muted" if muted == "1" else ""
    ap = "autoplay" if autoplay == "1" else ""
    lp = "loop" if loop == "1" else ""
    poster_attr = f'poster="{poster}"' if poster else ""
    obj_fit = fit if fit in ("cover", "contain", "auto") else "cover"
    html = f"""<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>*{{margin:0;padding:0;overflow:hidden}}body{{background:#000;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center}}
video{{width:100%;height:100%;object-fit:{obj_fit}}}</style></head>
<body><video id="v" src="/api/media/{filename}" {ap} {lp} {mt} playsinline webkit-playsinline preload="auto" {ctrl} {poster_attr} style="background:#000"></video>
<script>var v=document.getElementById('v');
v.addEventListener('loadedmetadata',function(){{
  var fit='{obj_fit}';
  if(fit==='auto'){{
    v.style.objectFit=(v.videoWidth>v.videoHeight)?'contain':'cover';
  }}
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('ready:'+v.videoWidth+'x'+v.videoHeight);
}});
v.addEventListener('playing',function(){{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('playing')}});
v.addEventListener('pause',function(){{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('paused')}});
v.addEventListener('error',function(){{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('error:'+JSON.stringify(v.error))}});
</script></body></html>"""
    return HTMLResponse(content=html, media_type="text/html")

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Beat Mates API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# ==================== VIDEO CALL (Daily.co) ====================
DAILY_API_KEY = os.environ.get('DAILY_API_KEY', '')
DAILY_API_URL = "https://api.daily.co/v1"

@api_router.post("/video-call/create-room")
async def create_video_room(session_id: str = None, current_user: dict = Depends(get_current_user)):
    if not DAILY_API_KEY:
        raise HTTPException(status_code=500, detail="Daily.co API key not configured")
    room_name = f"beatmates-{uuid.uuid4().hex[:12]}"
    exp_timestamp = int((datetime.utcnow() + timedelta(hours=2)).timestamp())
    async with httpx.AsyncClient() as client_http:
        response = await client_http.post(
            f"{DAILY_API_URL}/rooms",
            headers={"Authorization": f"Bearer {DAILY_API_KEY}", "Content-Type": "application/json"},
            json={"name": room_name, "privacy": "public", "properties": {"exp": exp_timestamp, "enable_chat": True, "max_participants": 2, "enable_prejoin_ui": False, "enable_knocking": False, "enable_screenshare": False}}
        )
        if response.status_code != 200:
            logger.error(f"Daily.co room creation failed: {response.text}")
            raise HTTPException(status_code=500, detail="Failed to create video room")
        room_data = response.json()
    if session_id:
        await db.live_sessions.update_one({"id": session_id}, {"$set": {"room_url": room_data["url"], "room_name": room_name}})
    return {"room_name": room_name, "room_url": room_data["url"], "session_id": session_id}

@api_router.post("/video-call/token")
async def get_video_call_token(room_name: str, current_user: dict = Depends(get_current_user)):
    if not DAILY_API_KEY:
        raise HTTPException(status_code=500, detail="Daily.co API key not configured")
    exp_timestamp = int((datetime.utcnow() + timedelta(hours=2)).timestamp())
    async with httpx.AsyncClient() as client_http:
        response = await client_http.post(
            f"{DAILY_API_URL}/meeting-tokens",
            headers={"Authorization": f"Bearer {DAILY_API_KEY}", "Content-Type": "application/json"},
            json={"properties": {"room_name": room_name, "user_name": current_user.get("name", current_user["username"]), "user_id": current_user["id"], "exp": exp_timestamp, "start_video_off": False, "start_audio_off": False, "enable_prejoin_ui": False}}
        )
        if response.status_code != 200:
            logger.error(f"Daily.co token generation failed: {response.text}")
            raise HTTPException(status_code=500, detail="Failed to generate meeting token")
        token_data = response.json()
    return {"token": token_data["token"]}

@api_router.post("/video-call/end/{room_name}")
async def end_video_call(room_name: str, current_user: dict = Depends(get_current_user)):
    if not DAILY_API_KEY:
        raise HTTPException(status_code=500, detail="Daily.co API key not configured")
    async with httpx.AsyncClient() as client_http:
        await client_http.delete(f"{DAILY_API_URL}/rooms/{room_name}", headers={"Authorization": f"Bearer {DAILY_API_KEY}"})
    session = await db.live_sessions.find_one({"room_name": room_name})
    if session:
        await db.live_sessions.update_one({"room_name": room_name}, {"$set": {"status": "completed", "ended_at": datetime.utcnow()}})
    return {"status": "ended"}

# ==================== MUSIC / PLAYLISTS ====================

class PlaylistCreate(BaseModel):
    name: str
    genre: Optional[str] = "ALL"
    is_premium: bool = False
    price_monthly: float = 0.0  # Monthly subscription price in USD

class PlaylistResponse(BaseModel):
    id: str
    user_id: str
    name: str
    genre: str
    song_count: int = 0
    is_premium: bool = False
    price_monthly: float = 0.0
    created_at: datetime

class SongResponse(BaseModel):
    id: str
    user_id: str
    title: str
    artist: str
    genre: str
    file_url: str
    cover_image: Optional[str] = None
    duration: float = 0
    is_liked: bool = False
    playlist_id: Optional[str] = None
    playlist_name: Optional[str] = None
    created_at: datetime

MUSIC_GENRES = ["ALL", "SAMBA", "TANGO", "LATIN", "HIP HOP", "JAZZ", "CONTEMPORARY", "AFRO", "REGGAETON"]

@api_router.get("/music/genres")
async def get_music_genres():
    return MUSIC_GENRES

@api_router.post("/music/playlists")
async def create_playlist(data: PlaylistCreate, current_user: dict = Depends(get_current_user)):
    playlist = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "name": data.name,
        "genre": data.genre,
        "is_premium": data.is_premium,
        "price_monthly": data.price_monthly if data.is_premium else 0.0,
        "created_at": datetime.utcnow(),
    }
    await db.playlists.insert_one(playlist)
    playlist.pop("_id", None)
    playlist["song_count"] = 0
    return PlaylistResponse(**playlist)

@api_router.get("/music/playlists")
async def get_playlists(current_user: dict = Depends(get_current_user)):
    playlists = await db.playlists.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    result = []
    for p in playlists:
        count = await db.songs.count_documents({"playlist_id": p["id"]})
        p["song_count"] = count
        p.setdefault("is_premium", False)
        p.setdefault("price_monthly", 0.0)
        result.append(PlaylistResponse(**p))
    return result

# Get all premium playlists (from all users)
@api_router.get("/music/playlists/premium")
async def get_premium_playlists(current_user: dict = Depends(get_current_user)):
    playlists = await db.playlists.find({"is_premium": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    result = []
    for p in playlists:
        count = await db.songs.count_documents({"playlist_id": p["id"]})
        p["song_count"] = count
        # Get owner info
        owner = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "password_hash": 0})
        p["owner"] = {"username": owner.get("username", ""), "name": owner.get("name", "")} if owner else None
        # Check if user is subscribed
        sub = await db.playlist_subscriptions.find_one({"user_id": current_user["id"], "playlist_id": p["id"]})
        p["is_subscribed"] = sub is not None
        result.append(p)
    return result

# Subscribe to premium playlist (mock)
@api_router.post("/music/playlists/{playlist_id}/subscribe")
async def subscribe_to_playlist(playlist_id: str, current_user: dict = Depends(get_current_user)):
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    existing = await db.playlist_subscriptions.find_one({
        "user_id": current_user["id"],
        "playlist_id": playlist_id
    })
    if existing:
        return {"message": "Already subscribed", "id": existing["id"]}
    
    subscription = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "playlist_id": playlist_id,
        "status": "active",
        "created_at": datetime.utcnow()
    }
    await db.playlist_subscriptions.insert_one(subscription)
    return {"message": "Subscribed", "id": subscription["id"]}

# Check subscription status
@api_router.get("/music/playlists/{playlist_id}/subscription")
async def check_subscription(playlist_id: str, current_user: dict = Depends(get_current_user)):
    sub = await db.playlist_subscriptions.find_one({
        "user_id": current_user["id"],
        "playlist_id": playlist_id
    })
    return {"subscribed": sub is not None}

@api_router.delete("/music/playlists/{playlist_id}")
async def delete_playlist(playlist_id: str, current_user: dict = Depends(get_current_user)):
    await db.playlists.delete_one({"id": playlist_id, "user_id": current_user["id"]})
    await db.songs.update_many({"playlist_id": playlist_id}, {"$set": {"playlist_id": None}})
    return {"status": "deleted"}

@api_router.post("/music/songs/upload")
async def upload_song(
    file: UploadFile = File(...),
    title: str = Form(...),
    artist: str = Form(""),
    genre: str = Form("ALL"),
    playlist_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'mp3'
    filename = f"{file_id}.{ext}"
    file_path = UPLOADS_DIR / filename
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Try to get duration using ffprobe
    duration = 0.0
    try:
        import subprocess
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(file_path)],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            duration = float(result.stdout.strip())
    except:
        pass

    # Get playlist name if playlist_id provided
    playlist_name = None
    if playlist_id:
        pl = await db.playlists.find_one({"id": playlist_id}, {"_id": 0, "name": 1})
        if pl:
            playlist_name = pl["name"]

    song = {
        "id": file_id,
        "user_id": current_user["id"],
        "title": title,
        "artist": artist or "Unknown",
        "genre": genre,
        "file_url": f"/api/uploads/{filename}",
        "cover_image": None,
        "duration": duration,
        "playlist_id": playlist_id,
        "playlist_name": playlist_name,
        "created_at": datetime.utcnow(),
    }
    await db.songs.insert_one(song)
    song.pop("_id", None)

    # Check if user liked this song
    song["is_liked"] = False
    return SongResponse(**song)

@api_router.get("/music/songs")
async def get_songs(genre: Optional[str] = None, playlist_id: Optional[str] = None, liked_only: bool = False, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if genre and genre != "ALL":
        query["genre"] = genre
    if playlist_id:
        query["playlist_id"] = playlist_id

    songs = await db.songs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

    # Get liked song IDs
    liked_songs = await db.song_likes.find({"user_id": current_user["id"]}).to_list(500)
    liked_ids = {l["song_id"] for l in liked_songs}

    if liked_only:
        songs = [s for s in songs if s["id"] in liked_ids]

    result = []
    for s in songs:
        s["is_liked"] = s["id"] in liked_ids
        # Get playlist name
        if s.get("playlist_id") and not s.get("playlist_name"):
            pl = await db.playlists.find_one({"id": s["playlist_id"]}, {"_id": 0, "name": 1})
            s["playlist_name"] = pl["name"] if pl else None
        result.append(SongResponse(**s))
    return result

@api_router.post("/music/songs/{song_id}/like")
async def toggle_song_like(song_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.song_likes.find_one({"song_id": song_id, "user_id": current_user["id"]})
    if existing:
        await db.song_likes.delete_one({"_id": existing["_id"]})
        return {"liked": False}
    else:
        await db.song_likes.insert_one({"song_id": song_id, "user_id": current_user["id"], "created_at": datetime.utcnow()})
        return {"liked": True}

@api_router.put("/music/songs/{song_id}/playlist")
async def move_song_to_playlist(song_id: str, playlist_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Move a song to a different playlist or remove from playlist."""
    update = {"playlist_id": playlist_id}
    if playlist_id:
        pl = await db.playlists.find_one({"id": playlist_id}, {"_id": 0, "name": 1})
        update["playlist_name"] = pl["name"] if pl else None
    else:
        update["playlist_name"] = None
    await db.songs.update_one({"id": song_id, "user_id": current_user["id"]}, {"$set": update})
    return {"status": "updated"}

@api_router.delete("/music/songs/{song_id}")
async def delete_song(song_id: str, current_user: dict = Depends(get_current_user)):
    await db.songs.delete_one({"id": song_id, "user_id": current_user["id"]})
    await db.song_likes.delete_many({"song_id": song_id})
    return {"status": "deleted"}

# ====================== VIDEO LESSONS ======================

@api_router.post("/video-lessons", response_model=VideoLessonResponse)
async def create_video_lesson(
    title: str = Form(...),
    description: str = Form(""),
    price: float = Form(...),
    currency: str = Form("EUR"),
    video: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    import subprocess
    lesson_id = str(uuid.uuid4())
    
    # Save original upload
    orig_filename = f"orig_{uuid.uuid4()}.mp4"
    orig_path = UPLOADS_DIR / orig_filename
    content = await video.read()
    with open(orig_path, "wb") as f:
        f.write(content)
    
    # Compress video with ffmpeg (lighter format, compatible with iOS)
    final_filename = f"{uuid.uuid4()}.mp4"
    final_path = UPLOADS_DIR / final_filename
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", str(orig_path),
            "-c:v", "libx264", "-preset", "fast", "-crf", "28",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            "-vf", "scale='min(720,iw)':-2",
            str(final_path)
        ], capture_output=True, timeout=120)
        if final_path.exists() and final_path.stat().st_size > 0:
            orig_path.unlink(missing_ok=True)
        else:
            final_filename = orig_filename
            final_path = orig_path
    except Exception:
        final_filename = orig_filename
        final_path = orig_path
    
    # Generate thumbnail
    thumb_filename = f"thumb_{lesson_id}.jpg"
    thumb_path = UPLOADS_DIR / thumb_filename
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", str(final_path), "-ss", "00:00:01",
            "-vframes", "1", "-vf", "scale=640:-1", "-q:v", "4", str(thumb_path)
        ], capture_output=True, timeout=15)
        if not thumb_path.exists():
            thumb_filename = None
    except Exception:
        thumb_filename = None
    
    # Get duration
    duration_minutes = 0
    try:
        result = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(final_path)
        ], capture_output=True, text=True, timeout=10)
        secs = float(result.stdout.strip())
        duration_minutes = round(secs / 60)
    except Exception:
        pass
    
    lesson = {
        "id": lesson_id,
        "user_id": current_user["id"],
        "title": title,
        "description": description,
        "price": price,
        "currency": currency,
        "duration_minutes": duration_minutes,
        "video_url": final_filename,
        "thumbnail_url": thumb_filename,
        "reviews_count": 0,
        "avg_rating": 0.0,
        "created_at": datetime.utcnow(),
    }
    await db.video_lessons.insert_one(lesson)
    lesson.pop("_id", None)
    lesson["user"] = {"id": current_user["id"], "username": current_user["username"], "name": current_user["name"], "profile_image": current_user.get("profile_image")}
    return VideoLessonResponse(**lesson)

@api_router.get("/video-lessons", response_model=List[VideoLessonResponse])
async def list_video_lessons(user_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": user_id} if user_id else {}
    lessons = await db.video_lessons.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    for lesson in lessons:
        u = await db.users.find_one({"id": lesson["user_id"]}, {"_id": 0, "id": 1, "username": 1, "name": 1, "profile_image": 1})
        lesson["user"] = u
        lesson.setdefault("reviews_count", 0)
        lesson.setdefault("avg_rating", 0.0)
    return [VideoLessonResponse(**l) for l in lessons]

@api_router.get("/users/{user_id}/video-lessons", response_model=List[VideoLessonResponse])
async def get_user_video_lessons(user_id: str, current_user: dict = Depends(get_current_user)):
    lessons = await db.video_lessons.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for lesson in lessons:
        u = await db.users.find_one({"id": lesson["user_id"]}, {"_id": 0, "id": 1, "username": 1, "name": 1, "profile_image": 1})
        lesson["user"] = u
        lesson.setdefault("reviews_count", 0)
        lesson.setdefault("avg_rating", 0.0)
    return [VideoLessonResponse(**l) for l in lessons]

@api_router.put("/video-lessons/{lesson_id}", response_model=VideoLessonResponse)
async def update_video_lesson(lesson_id: str, data: VideoLessonUpdate, current_user: dict = Depends(get_current_user)):
    lesson = await db.video_lessons.find_one({"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if lesson["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your lesson")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if update_data:
        await db.video_lessons.update_one({"id": lesson_id}, {"$set": update_data})
    
    updated = await db.video_lessons.find_one({"id": lesson_id}, {"_id": 0})
    updated["user"] = {"id": current_user["id"], "username": current_user["username"], "name": current_user["name"], "profile_image": current_user.get("profile_image")}
    return VideoLessonResponse(**updated)

@api_router.delete("/video-lessons/{lesson_id}")
async def delete_video_lesson(lesson_id: str, current_user: dict = Depends(get_current_user)):
    lesson = await db.video_lessons.find_one({"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if lesson["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your lesson")
    await db.video_lessons.delete_one({"id": lesson_id})
    await db.lesson_reviews.delete_many({"lesson_id": lesson_id})
    return {"status": "deleted"}

# ====================== LESSON REVIEWS ======================

@api_router.post("/video-lessons/{lesson_id}/reviews", response_model=ReviewResponse)
async def create_review(lesson_id: str, data: ReviewCreate, current_user: dict = Depends(get_current_user)):
    lesson = await db.video_lessons.find_one({"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if lesson["user_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot review your own lesson")
    existing = await db.lesson_reviews.find_one({"lesson_id": lesson_id, "user_id": current_user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed")
    
    review = {
        "id": str(uuid.uuid4()),
        "lesson_id": lesson_id,
        "user_id": current_user["id"],
        "rating": max(1, min(5, data.rating)),
        "text": data.text,
        "created_at": datetime.utcnow(),
    }
    await db.lesson_reviews.insert_one(review)
    review.pop("_id", None)
    
    # Update lesson stats
    all_reviews = await db.lesson_reviews.find({"lesson_id": lesson_id}, {"_id": 0, "rating": 1}).to_list(1000)
    avg = sum(r["rating"] for r in all_reviews) / len(all_reviews) if all_reviews else 0
    await db.video_lessons.update_one({"id": lesson_id}, {"$set": {"reviews_count": len(all_reviews), "avg_rating": round(avg, 1)}})
    
    review["user"] = {"id": current_user["id"], "username": current_user["username"], "name": current_user["name"], "profile_image": current_user.get("profile_image")}
    return ReviewResponse(**review)

@api_router.get("/video-lessons/{lesson_id}/reviews", response_model=List[ReviewResponse])
async def get_lesson_reviews(lesson_id: str, current_user: dict = Depends(get_current_user)):
    reviews = await db.lesson_reviews.find({"lesson_id": lesson_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in reviews:
        u = await db.users.find_one({"id": r["user_id"]}, {"_id": 0, "id": 1, "username": 1, "name": 1, "profile_image": 1})
        r["user"] = u
    return [ReviewResponse(**r) for r in reviews]

# ====================== CHAT / MESSAGING ======================

@api_router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    convos = await db.conversations.find(
        {"participants": current_user["id"]}, {"_id": 0}
    ).sort("updated_at", -1).to_list(50)
    
    for c in convos:
        other_id = [p for p in c["participants"] if p != current_user["id"]]
        if other_id:
            other_user = await db.users.find_one({"id": other_id[0]}, {"_id": 0, "id": 1, "username": 1, "name": 1, "profile_image": 1})
            c["other_user"] = other_user
        else:
            c["other_user"] = None
    return convos

@api_router.post("/conversations")
async def create_or_get_conversation(data: dict, current_user: dict = Depends(get_current_user)):
    other_id = data.get("user_id")
    if not other_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    # Check if conversation already exists
    existing = await db.conversations.find_one({
        "participants": {"$all": [current_user["id"], other_id]}
    }, {"_id": 0})
    if existing:
        return existing
    
    convo = {
        "id": str(uuid.uuid4()),
        "participants": [current_user["id"], other_id],
        "last_message": None,
        "updated_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
    }
    await db.conversations.insert_one(convo)
    convo.pop("_id", None)
    return convo

@api_router.get("/conversations/{convo_id}/messages")
async def get_messages(convo_id: str, current_user: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": convo_id})
    if not convo or current_user["id"] not in convo.get("participants", []):
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    for m in messages:
        u = await db.users.find_one({"id": m["sender_id"]}, {"_id": 0, "id": 1, "username": 1, "profile_image": 1})
        m["sender"] = u
    return messages

@api_router.post("/conversations/{convo_id}/messages")
async def send_message(convo_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": convo_id})
    if not convo or current_user["id"] not in convo.get("participants", []):
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    text = data.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text required")
    
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": convo_id,
        "sender_id": current_user["id"],
        "text": text,
        "created_at": datetime.utcnow(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": convo_id},
        {"$set": {"last_message": text, "updated_at": datetime.utcnow()}}
    )
    
    msg["sender"] = {"id": current_user["id"], "username": current_user["username"], "profile_image": current_user.get("profile_image")}
    return msg

# ==================== PURCHASES (MOCK) ====================

class MockPurchase(BaseModel):
    lesson_id: str

@api_router.get("/purchases/check/{lesson_id}")
async def check_purchase(lesson_id: str, current_user: dict = Depends(get_current_user)):
    purchase = await db.purchases.find_one({
        "user_id": current_user["id"],
        "lesson_id": lesson_id
    })
    return {"purchased": purchase is not None}

@api_router.post("/purchases/mock")
async def mock_purchase(data: MockPurchase, current_user: dict = Depends(get_current_user)):
    # Check if already purchased
    existing = await db.purchases.find_one({
        "user_id": current_user["id"],
        "lesson_id": data.lesson_id
    })
    if existing:
        return {"message": "Already purchased", "id": existing["id"]}
    
    # Create mock purchase
    purchase = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "lesson_id": data.lesson_id,
        "amount": 0,  # Mock
        "status": "completed",
        "created_at": datetime.utcnow()
    }
    await db.purchases.insert_one(purchase)
    return {"message": "Purchase recorded", "id": purchase["id"]}



# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
