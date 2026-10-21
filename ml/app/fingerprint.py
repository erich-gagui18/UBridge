import hashlib


def content_hash(chunks):
    body = "\x1e".join("\x1f".join([c["id"], c.get("title", ""), c["text"]]) for c in chunks)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()
