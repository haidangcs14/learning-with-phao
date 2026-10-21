from app.common.exceptions import AppException, NotFoundError
from app.modules.admin.importer import parse_rows, validate_rows
from app.modules.admin.repository import AdminRepository
from app.modules.auth.repository import RefreshTokenRepository
from app.modules.users.repository import UserRepository


class AdminService:
    def __init__(self, repo: AdminRepository, users: UserRepository, tokens: RefreshTokenRepository):
        self.repo, self.users, self.tokens = repo, users, tokens

    async def update_user(self, admin_id: str, user_id: str, fields: dict) -> dict:
        if user_id == admin_id:
            raise AppException(400, "CANNOT_MODIFY_SELF", "You cannot change your own role or status")
        user = await self.users.update(user_id, fields)
        if not user:
            raise NotFoundError("USER_NOT_FOUND", "User not found")
        if fields.get("is_active") is False:
            await self.tokens.revoke_user(user_id)  # kick deactivated users out immediately
        return user

    async def delete_user(self, admin_id: str, user_id: str) -> None:
        if user_id == admin_id:
            raise AppException(400, "CANNOT_MODIFY_SELF", "You cannot delete yourself")
        if not await self.users.delete(user_id):
            raise NotFoundError("USER_NOT_FOUND", "User not found")
        await self.tokens.revoke_user(user_id)

    async def import_preview(self, admin_id: str, filename: str, content_type, content: bytes) -> dict:
        valid, errors = validate_rows(parse_rows(filename, content_type, content))
        import_id = await self.repo.save_preview(admin_id, valid) if valid else None
        return {"import_id": import_id, "valid_count": len(valid), "error_count": len(errors),
                "errors": errors, "preview": valid[:10]}

    async def import_confirm(self, admin_id: str, import_id: str) -> int:
        preview = await self.repo.pop_preview(import_id, admin_id)
        if not preview:
            raise NotFoundError("IMPORT_NOT_FOUND", "Import preview not found or expired")
        return await self.repo.insert_questions(preview["rows"])

    async def delete_question(self, qid: str) -> None:
        if not await self.repo.delete_question(qid):
            raise NotFoundError("QUESTION_NOT_FOUND", "Question not found")
