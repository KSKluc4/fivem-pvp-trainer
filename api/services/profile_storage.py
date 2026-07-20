from database import get_supabase

BUCKET = 'profiles'


def upload_profile_image(path: str, data: bytes) -> str:
    """Uploads (overwriting any existing object at `path`) and returns the
    bucket's public URL for it. The bucket is public and the caller always
    appends its own cache-busting query string, so the raw URL is returned
    as-is."""
    sb = get_supabase()
    sb.storage.from_(BUCKET).upload(
        path, data,
        {'content-type': 'image/webp', 'upsert': 'true'},
    )
    return sb.storage.from_(BUCKET).get_public_url(path)


def delete_profile_image(path: str) -> None:
    sb = get_supabase()
    try:
        sb.storage.from_(BUCKET).remove([path])
    except Exception:
        pass  # already gone / never existed — deleting is best-effort
