from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
import base64
import json
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'beatmates')]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'beatmates-secret-key-2025')
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
    media: Optional[str] = None  # base64 encoded
    caption: Optional[str] = ""

class PostResponse(BaseModel):
    id: str
    user_id: str
    user: Optional[dict] = None
    type: str
    media: Optional[str] = None
    caption: str = ""
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False
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

class LiveSessionResponse(BaseModel):
    id: str
    student_id: str
    teacher_id: str
    teacher: Optional[dict] = None
    student: Optional[dict] = None
    status: str  # pending, accepted, active, completed, rejected
    amount: float
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
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user["id"]})
    return UserResponse(**{k: v for k, v in updated_user.items() if k != "password_hash"})

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
    
    # Save media to file if it's base64
    media_url = None
    if data.media:
        if data.media.startswith('data:'):
            # Base64 encoded - save to file
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
                media_url = data.media  # fallback to base64
        elif data.media.startswith('file://'):
            # Local file URI - can't use server-side, skip
            media_url = None
        else:
            media_url = data.media
    
    post = {
        "id": post_id,
        "user_id": current_user["id"],
        "type": data.type,
        "media": media_url,
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
        "type": data.type,
        "views_count": 0,
        "created_at": now,
        "expires_at": now + timedelta(hours=24)
    }
    
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
    # Get following users + users with same categories
    following = await db.follows.find({"follower_id": current_user["id"]}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    
    # Add users with matching dance categories
    user_categories = current_user.get("dance_categories", [])
    if user_categories:
        category_users = await db.users.find({
            "dance_categories": {"$in": user_categories}
        }).to_list(1000)
        category_user_ids = [u["id"] for u in category_users]
        following_ids.extend(category_user_ids)
    
    following_ids = list(set(following_ids))
    
    # Get non-expired stories from these users
    now = datetime.utcnow()
    stories = await db.stories.find({
        "user_id": {"$in": following_ids},
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
    # Get users who are available now AND share at least one category with current user
    user_categories = current_user.get("dance_categories", [])
    
    query = {"is_available": True, "id": {"$ne": current_user["id"]}}
    
    # If user has categories, filter by matching categories
    if user_categories:
        query["dance_categories"] = {"$in": user_categories}
    
    users = await db.users.find(query).to_list(100)
    
    result = []
    for user in users:
        result.append({
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "profile_image": user.get("profile_image"),
            "rating": user.get("rating", 0),
            "hourly_rate": user.get("hourly_rate", 50),
            "dance_categories": user.get("dance_categories", []),
            "available_since": user.get("available_since", datetime.utcnow())
        })
    
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
    
    await db.live_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "active", "started_at": datetime.utcnow()}}
    )
    
    session = await db.live_sessions.find_one({"id": session_id})
    teacher = await db.users.find_one({"id": session["teacher_id"]})
    session["teacher"] = {
        "id": teacher["id"],
        "username": teacher["username"],
        "name": teacher["name"],
        "profile_image": teacher.get("profile_image")
    }
    
    return LiveSessionResponse(**session)

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
    
    return LiveSessionResponse(**session)

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
    if file.content_type:
        if 'video' in file.content_type:
            if ext not in ['mp4', 'mov', 'avi', 'webm']:
                ext = 'mp4'
        elif 'png' in file.content_type:
            ext = 'png'
        elif 'gif' in file.content_type:
            ext = 'gif'
        elif 'webp' in file.content_type:
            ext = 'webp'

    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOADS_DIR / filename

    content = await file.read()
    with open(filepath, 'wb') as f:
        f.write(content)

    url = f"/api/uploads/{filename}"
    media_type = "video" if file.content_type and 'video' in file.content_type else "image"
    return {"url": url, "filename": filename, "media_type": media_type}

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Beat Mates API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

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
