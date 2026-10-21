import cachecontrol
import requests
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

UB_EMAIL_SUFFIX = "@ub.edu.ph"


class AuthError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


class FirebaseVerifier:
    def __init__(self, project_id):
        self.project_id = project_id
        session = cachecontrol.CacheControl(requests.session())
        self._request = google_requests.Request(session=session)

    def __call__(self, token):
        try:
            claims = id_token.verify_firebase_token(token, self._request, audience=self.project_id)
        except Exception as exc:
            raise AuthError(401, "invalid token") from exc
        if not claims:
            raise AuthError(401, "invalid token")
        return claims


def check_claims(claims):
    email = str(claims.get("email", "")).lower()
    if not claims.get("email_verified") or not email.endswith(UB_EMAIL_SUFFIX):
        raise AuthError(403, "a verified UB account is required")
    return claims.get("uid") or claims.get("user_id") or claims.get("sub") or email
