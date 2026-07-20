import io
from PIL import Image

# Formats accepted for avatar/banner uploads. Checked against what Pillow
# itself identifies the file as (via its header-sniffing plugin system), not
# the filename/extension the client sent — this is what actually stops a
# renamed .exe from being accepted as a ".png".
ALLOWED_FORMATS = {'JPEG', 'PNG', 'WEBP'}

WEBP_QUALITY = 85


class InvalidImageError(Exception):
    pass


def process_image(raw: bytes, target_size: tuple) -> bytes:
    """Validates `raw` is a genuine JPEG/PNG/WEBP image, center-crops it to
    `target_size`'s aspect ratio and re-encodes as WEBP.

    Re-encoding into a fresh image (rather than just resizing in place) also
    drops any EXIF/metadata the original file carried, since only pixel data
    is copied over.
    """
    try:
        img = Image.open(io.BytesIO(raw))
        fmt = img.format
        img.verify()  # raises if the file is truncated/corrupt
    except Exception:
        raise InvalidImageError('Arquivo não é uma imagem válida')

    if fmt not in ALLOWED_FORMATS:
        raise InvalidImageError('Formato de imagem não suportado (use JPEG, PNG ou WEBP)')

    # verify() leaves the Image object unusable for further processing —
    # reopen from the same bytes to actually decode and transform it.
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    img = _crop_to_ratio(img, target_size)

    out = io.BytesIO()
    img.save(out, format='WEBP', quality=WEBP_QUALITY)
    return out.getvalue()


def _crop_to_ratio(img: Image.Image, target_size: tuple) -> Image.Image:
    target_w, target_h = target_size
    target_ratio = target_w / target_h
    w, h = img.size
    ratio = w / h

    if ratio > target_ratio:
        new_w = round(h * target_ratio)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    elif ratio < target_ratio:
        new_h = round(w / target_ratio)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))

    return img.resize(target_size, Image.LANCZOS)
