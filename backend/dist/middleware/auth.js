const VALID_ROLES = new Set(["viewer", "moderator", "admin"]);
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function authContextMiddleware(req, res, next) {
    const rawRole = String(req.header("x-user-role") ?? "").trim().toLowerCase();
    const rawUserId = String(req.header("x-user-id") ?? "").trim();
    if (!rawRole && !rawUserId) {
        return next();
    }
    if (!VALID_ROLES.has(rawRole)) {
        return res.status(400).json({ error: "Invalid x-user-role header" });
    }
    if ((rawRole === "moderator" || rawRole === "admin") && !isUuid(rawUserId)) {
        return res.status(400).json({ error: "x-user-id must be a valid UUID for moderator/admin roles" });
    }
    req.user = {
        id: isUuid(rawUserId) ? rawUserId : undefined,
        role: rawRole
    };
    return next();
}
