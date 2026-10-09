import express from "express";
import { handleCreateUser } from "./users/userCreate";
import { handleUpdateUser } from "./users/userUpdate";
import { handleDeleteUser } from "./users/userDelete";
import { handleUserList } from "./users/userList";

const router = express.Router();

// User management endpoints
router.post("/api/create-user", handleCreateUser);
router.post("/api/update-user", handleUpdateUser);
router.delete("/api/delete-user", handleDeleteUser);
router.post("/api/delete-user", handleDeleteUser);

// Profiles listing proxy
router.get("/api/profiles", handleUserList);

export default router;
