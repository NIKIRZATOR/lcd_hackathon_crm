from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

from fastapi import UploadFile

from app.modules.users.service import UserService


class FakeDatabase:
    def __init__(self) -> None:
        self.added = []
        self.commits = 0

    def add(self, value) -> None:
        self.added.append(value)

    def get(self, *_args):
        return None

    def flush(self) -> None:
        return None

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        return None

    def refresh(self, _value) -> None:
        return None


class FakeStorage:
    def __init__(self) -> None:
        self.upload = None

    def put(self, **kwargs) -> None:
        self.upload = kwargs

    def delete(self, **_kwargs) -> None:
        return None


def test_upload_avatar_stores_validated_file_in_avatar_bucket(monkeypatch) -> None:
    db = FakeDatabase()
    storage = FakeStorage()
    user = SimpleNamespace(id=uuid4(), avatar_file_id=None)
    png = b"\x89PNG\r\n\x1a\nimage"
    upload = UploadFile(filename="profile.png", file=BytesIO(png), headers={"content-type": "image/png"})
    monkeypatch.setattr("app.modules.users.service.get_storage_adapter", lambda: storage)

    avatar = UserService(db).upload_avatar(user, upload)

    assert user.avatar_file_id == avatar.id
    assert avatar.attachment_kind == "user_avatar"
    assert storage.upload["bucket"] == "user-avatars"
    assert storage.upload["data"].getvalue() == png
    assert db.commits == 1


def test_upload_avatar_rejects_invalid_image_signature() -> None:
    upload = UploadFile(
        filename="profile.png",
        file=BytesIO(b"not a png"),
        headers={"content-type": "image/png"},
    )

    try:
        UserService(FakeDatabase()).upload_avatar(SimpleNamespace(id=uuid4(), avatar_file_id=None), upload)
    except Exception as error:
        assert getattr(error, "status_code", None) == 422
    else:
        raise AssertionError("Invalid image was accepted")
