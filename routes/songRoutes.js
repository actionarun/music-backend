const express = require("express");
const router = express.Router();
const {
  createSong,
  getSongs,
  searchSongs,
  getSongById,
  updateSong,
  deleteSong,
  streamSong,
  downloadSong,
  toggleLikeSong,
  addComment,
  deleteComment,
} = require("../controllers/songController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

router.get("/", optionalAuth, getSongs);
router.get("/search", searchSongs);

router.post(
  "/",
  protect,
  upload.fields([{ name: "audioFile", maxCount: 1 }, { name: "coverImage", maxCount: 1 }]),
  createSong
);

router.get("/:id", getSongById);
router.put("/:id", protect, updateSong);       // NEW
router.delete("/:id", protect, deleteSong);    // NEW

router.get("/:id/stream", streamSong);
router.get("/:id/download", protect, downloadSong);
router.put("/:id/like", protect, toggleLikeSong);
router.post("/:id/comments", protect, addComment);
router.delete("/:id/comments/:commentId", protect, deleteComment);

module.exports = router;