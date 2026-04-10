import "express";

declare global {
  namespace Express {
    type AppUserRole = "viewer" | "moderator" | "admin";

    interface Request {
      requestId?: string;
      user?: {
        id?: string;
        role: AppUserRole;
      };
    }
  }
}

export {};
