"""
Migration script: Upload ALL local media to Bunny CDN and update MongoDB.
- Videos -> Bunny Stream (HLS)
- Images -> Bunny Storage (CDN)
Then update all posts, stories, and user profile_images in MongoDB.
"""
import os
import asyncio
import httpx
import pymongo
import uuid
import re
from pathlib import Path

# Bunny config
BUNNY_STREAM_API_URL = "https://video.bunnycdn.com"
BUNNY_STREAM_LIBRARY_ID = os.environ.get("BUNNY_STREAM_LIBRARY_ID", "635479")
BUNNY_STREAM_API_KEY = os.environ.get("BUNNY_STREAM_API_KEY", "a4259ebe-259a-412e-8b30e50de798-7aee-468d")
BUNNY_STORAGE_URL = "https://storage.bunnycdn.com"
BUNNY_STORAGE_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "beatmates-media")
BUNNY_STORAGE_API_KEY = os.environ.get("BUNNY_STORAGE_API_KEY", "a5975055-b9f4-4ee7-a7aa208d480a-5ae9-4ae0")
BUNNY_CDN_URL = os.environ.get("BUNNY_CDN_URL", "https://beatmates-cd.b-cdn.net")

UPLOADS_DIR = Path("/app/backend/uploads")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "beatmates")

client = pymongo.MongoClient(MONGO_URL)
db = client[DB_NAME]

# Track uploaded files to avoid duplicates
uploaded_images = {}  # filename -> cdn_url
uploaded_videos = {}  # filename -> embed_url

async def upload_video_to_bunny(filepath: Path) -> dict:
    """Upload video to Bunny Stream, return {embed_url, guid}"""
    filename = filepath.name
    if filename in uploaded_videos:
        print(f"  [SKIP] Already uploaded: {filename}")
        return uploaded_videos[filename]
    
    content = filepath.read_bytes()
    print(f"  [VIDEO] Uploading {filename} ({len(content)/1024/1024:.1f} MB)...")
    
    async with httpx.AsyncClient(timeout=300.0) as client_http:
        # Create video entry
        create_resp = await client_http.post(
            f"{BUNNY_STREAM_API_URL}/library/{BUNNY_STREAM_LIBRARY_ID}/videos",
            headers={"AccessKey": BUNNY_STREAM_API_KEY, "Content-Type": "application/json"},
            json={"title": filename}
        )
        if create_resp.status_code != 200:
            print(f"  [ERROR] Create failed: {create_resp.text}")
            return None
        
        guid = create_resp.json()["guid"]
        
        # Upload binary
        upload_resp = await client_http.put(
            f"{BUNNY_STREAM_API_URL}/library/{BUNNY_STREAM_LIBRARY_ID}/videos/{guid}",
            headers={"AccessKey": BUNNY_STREAM_API_KEY, "Content-Type": "application/octet-stream"},
            content=content
        )
        if upload_resp.status_code != 200:
            print(f"  [ERROR] Upload failed: {upload_resp.text}")
            return None
        
        result = {
            "embed_url": f"https://iframe.mediadelivery.net/embed/{BUNNY_STREAM_LIBRARY_ID}/{guid}",
            "guid": guid
        }
        uploaded_videos[filename] = result
        print(f"  [OK] Video uploaded: {guid}")
        return result

async def upload_image_to_bunny(filepath: Path) -> str:
    """Upload image to Bunny Storage, return CDN URL"""
    filename = filepath.name
    if filename in uploaded_images:
        print(f"  [SKIP] Already uploaded: {filename}")
        return uploaded_images[filename]
    
    content = filepath.read_bytes()
    print(f"  [IMAGE] Uploading {filename} ({len(content)/1024:.0f} KB)...")
    
    async with httpx.AsyncClient(timeout=60.0) as client_http:
        resp = await client_http.put(
            f"{BUNNY_STORAGE_URL}/{BUNNY_STORAGE_ZONE}/{filename}",
            headers={"AccessKey": BUNNY_STORAGE_API_KEY, "Content-Type": "application/octet-stream"},
            content=content
        )
        if resp.status_code == 201:
            cdn_url = f"{BUNNY_CDN_URL}/{filename}"
            uploaded_images[filename] = cdn_url
            print(f"  [OK] Image uploaded: {cdn_url}")
            return cdn_url
        else:
            print(f"  [ERROR] Upload failed ({resp.status_code}): {resp.text}")
            return None

def extract_filename(media_path: str) -> str:
    """Extract filename from /api/uploads/xxx.jpg or /api/media/xxx.jpg"""
    if not media_path:
        return None
    # Remove path prefixes
    name = media_path.replace("/api/uploads/", "").replace("/api/media/", "")
    if "/" in name:
        name = name.split("/")[-1]
    return name

def is_video_file(filename: str) -> bool:
    if not filename:
        return False
    lower = filename.lower()
    return lower.endswith('.mp4') or lower.endswith('.mov') or lower.endswith('.webm')

async def migrate_media(media_path: str) -> str:
    """Migrate a single media path to Bunny CDN. Returns new URL or original if failed."""
    if not media_path:
        return media_path
    
    # Already on CDN
    if 'b-cdn.net' in media_path or 'mediadelivery.net' in media_path:
        return media_path
    
    filename = extract_filename(media_path)
    if not filename:
        return media_path
    
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        # Try without _thumb suffix
        print(f"  [WARN] File not found: {filepath}")
        return media_path
    
    if is_video_file(filename):
        result = await upload_video_to_bunny(filepath)
        if result:
            return result["embed_url"]
    else:
        cdn_url = await upload_image_to_bunny(filepath)
        if cdn_url:
            return cdn_url
    
    return media_path  # Fallback to original

async def main():
    print("=" * 60)
    print("BUNNY CDN MIGRATION - Beat Mates")
    print("=" * 60)
    
    # 1. Migrate Posts
    posts = list(db.posts.find({}))
    print(f"\n--- Migrating {len(posts)} posts ---")
    
    for i, post in enumerate(posts):
        post_id = post["id"]
        media = post.get("media", "")
        media_urls = post.get("media_urls", []) or []
        changed = False
        
        print(f"\n[Post {i+1}/{len(posts)}] {post_id[:12]}...")
        
        # Migrate main media
        if media and 'b-cdn.net' not in media and 'mediadelivery.net' not in media:
            new_media = await migrate_media(media)
            if new_media != media:
                db.posts.update_one({"id": post_id}, {"$set": {"media": new_media}})
                changed = True
                print(f"  Updated media: {media[:50]} -> {new_media[:50]}")
        
        # Migrate media_urls array
        new_urls = []
        urls_changed = False
        for url in media_urls:
            if url and 'b-cdn.net' not in url and 'mediadelivery.net' not in url:
                new_url = await migrate_media(url)
                new_urls.append(new_url)
                if new_url != url:
                    urls_changed = True
            else:
                new_urls.append(url)
        
        if urls_changed:
            db.posts.update_one({"id": post_id}, {"$set": {"media_urls": new_urls}})
            print(f"  Updated media_urls")
        
        if not changed and not urls_changed:
            print(f"  [SKIP] Already migrated or no media")
    
    # 2. Migrate Stories
    stories = list(db.stories.find({}))
    print(f"\n--- Migrating {len(stories)} stories ---")
    
    for i, story in enumerate(stories):
        story_id = story["id"]
        media = story.get("media", "")
        
        if not media or 'b-cdn.net' in media or 'mediadelivery.net' in media:
            continue
        
        print(f"\n[Story {i+1}/{len(stories)}] {story_id[:12]}...")
        new_media = await migrate_media(media)
        if new_media != media:
            db.stories.update_one({"id": story_id}, {"$set": {"media": new_media}})
            print(f"  Updated: {media[:50]} -> {new_media[:50]}")
    
    # 3. Migrate User profile images
    users = list(db.users.find({"profile_image": {"$ne": None, "$exists": True}}))
    print(f"\n--- Migrating {len(users)} user profile images ---")
    
    for user in users:
        uid = user["id"]
        img = user.get("profile_image", "")
        if not img or 'b-cdn.net' in img or 'mediadelivery.net' in img:
            continue
        
        print(f"\n[User] {uid[:12]}...")
        new_img = await migrate_media(img)
        if new_img != img:
            db.users.update_one({"id": uid}, {"$set": {"profile_image": new_img}})
            print(f"  Updated profile_image")
    
    # Summary
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print(f"  Videos uploaded to Bunny Stream: {len(uploaded_videos)}")
    print(f"  Images uploaded to Bunny Storage: {len(uploaded_images)}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
