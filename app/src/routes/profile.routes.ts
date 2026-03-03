import express from "express";
import type { RequestHandler } from "express";
import type multer from "multer";

interface ProfileRouteDeps {
  requireJwt: RequestHandler;
  upload: multer.Multer;
  handleUpdateProfile: RequestHandler;
  handleChangePassword: RequestHandler;
  handleUploadProfilePicture: RequestHandler;
}

export function buildProfileRoutes({
  requireJwt,
  upload,
  handleUpdateProfile,
  handleChangePassword,
  handleUploadProfilePicture,
}: ProfileRouteDeps): express.Router {
  const router = express.Router();

  router.post("/update", requireJwt, handleUpdateProfile);
  router.post("/change-password", requireJwt, handleChangePassword);
  router.post(
    "/upload-picture",
    requireJwt,
    upload.single("profilePicture"),
    handleUploadProfilePicture,
  );

  return router;
}
