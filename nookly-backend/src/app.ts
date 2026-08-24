import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { healthRouter } from "./routes/health.routes";
import { authRouter } from "./routes/auth.routes";
import { businessRouter } from "./routes/business.routes";
import { serviceRouter } from "./routes/service.routes";
import { photoRouter } from "./routes/photo.routes";
import { categoryRouter } from "./routes/category.routes";
import { adminRouter } from "./routes/admin.routes";
import { favoriteRouter } from "./routes/favorite.routes";
import { profileRouter } from "./routes/profile.routes";
import { accountRouter } from "./routes/account.routes";
import { kycRouter } from "./routes/kyc.routes";
import { ownerRouter } from "./routes/owner.routes";
import { conversationRouter } from "./routes/conversation.routes";
import { notificationRouter } from "./routes/notification.routes";
import { locationRouter } from "./routes/location.routes";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";
import { env } from "./config/env";

export function createApp(): Express {
  const app = express();

  // Security headers applied before every route. crossOriginResourcePolicy is
  // "cross-origin" because the frontend is served from a DIFFERENT origin (see
  // FRONTEND_URL) and loads public images directly from the R2 public bucket
  // via plain <img src>. CORP: same-origin (helmet default) would make browsers
  // block every cross-origin image load even though the API itself is
  // CORS-enabled. Private KYC documents live in the R2 private bucket and are
  // NEVER served publicly — they are streamed only through the authenticated
  // document routes.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // CORS: only configured frontend origins are allowed (see env.ts).
  // Credentials stay off — auth uses Bearer tokens in headers, not cookies.
  // Applied before every route so preflight/actual requests both pass.
  app.use(
    cors({
      origin: env.frontendOrigins,
      credentials: false,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // JSON body parsing with an EXPLICIT size cap. The Express default is
  // 100kb, but we state it here so the limit is documented in code rather
  // than implicitly relying on library defaults. Oversized bodies are
  // rejected by body-parser with a 413, mapped to a clean message in
  // error.middleware.ts.
  app.use(express.json({ limit: "100kb" }));

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/businesses", businessRouter);
  app.use("/services", serviceRouter);
  app.use("/photos", photoRouter);
  app.use("/categories", categoryRouter);
  app.use("/admin", adminRouter);
  app.use("/favorites", favoriteRouter);
  app.use("/locations", locationRouter);
  app.use("/profile", profileRouter);
  app.use("/account", accountRouter);
  app.use("/kyc", kycRouter);
  app.use("/owners", ownerRouter);
  app.use("/conversations", conversationRouter);
  app.use("/notifications", notificationRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
