import type { Business, UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
      business?: Business;
    }
  }
}

export {};
