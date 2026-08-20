const express = require("express");
const router = express.Router();
const {
  createSong,
  getSongs,
  searchSongs,
  getMySongs,
  getLikedSongs,
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



// must be registered before "/:id" — otherwise "mine" gets treated as an ID
router.get("/mine/uploaded", protect, getMySongs);
router.get("/mine/liked", protect, getLikedSongs);

router.post(
  "/",
  protect,
  upload.fields([{ name: "audioFile", maxCount: 1 }, { name: "coverImage", maxCount: 1 }]),
  createSong
);

router.get("/:id", getSongById);
router.put("/:id", protect, updateSong);
router.delete("/:id", protect, deleteSong);

router.get("/:id/stream", streamSong);
router.get("/:id/download", protect, downloadSong);
router.put("/:id/like", protect, toggleLikeSong);
router.post("/:id/comments", protect, addComment);
router.delete("/:id/comments/:commentId", protect, deleteComment);

module.exports = router;