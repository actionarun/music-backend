const express = require("express");
const router = express.Router();
const {
  createPlaylist,
  getMyPlaylists,
  getPlaylistById,
  updatePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  deletePlaylist,
  toggleLikePlaylist,
  getPublicPlaylists,
} = require("../controllers/playlistController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");

router.get("/", getPublicPlaylists);
router.get("/my", protect, getMyPlaylists);
router.post("/", protect, createPlaylist);

router.get("/:id", optionalAuth, getPlaylistById);
router.put("/:id", protect, updatePlaylist);
router.delete("/:id", protect, deletePlaylist);

router.put("/:id/songs/:songId", protect, addSongToPlaylist);
router.delete("/:id/songs/:songId", protect, removeSongFromPlaylist);

router.put("/:id/like", protect, toggleLikePlaylist);

module.exports = router;