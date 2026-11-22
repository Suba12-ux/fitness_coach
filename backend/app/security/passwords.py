"""Хеширование и проверка паролей (stdlib scrypt)."""

import base64
import hashlib
import hmac
import secrets

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16
_KEY_BYTES = 32
_MAX_MEM = 64 * 1024 * 1024


def hash_password(password: str) -> str:
    """Вернуть версионированный scrypt-хеш пароля."""
    salt = secrets.token_bytes(_SALT_BYTES)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        maxmem=_MAX_MEM,
        dklen=_KEY_BYTES,
    )
    return "$".join(
        (
            "scrypt",
            str(_SCRYPT_N),
            str(_SCRYPT_R),
            str(_SCRYPT_P),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(derived).decode("ascii"),
        )
    )


def verify_password(password: str, encoded: str) -> bool:
    """Проверить пароль по сохранённому хешу."""
    try:
        scheme, n_raw, r_raw, p_raw, salt_raw, hash_raw = encoded.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_raw, validate=True)
        expected = base64.b64decode(hash_raw, validate=True)
        derived = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n_raw),
            r=int(r_raw),
            p=int(p_raw),
            maxmem=_MAX_MEM,
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(derived, expected)


# Используется при входе с несуществующим email, чтобы время ответа
# не выдавало наличие аккаунта.
DUMMY_PASSWORD_HASH = hash_password("sensei-dummy-password")
