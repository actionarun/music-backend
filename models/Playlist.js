const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    songs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
    coverImage: { type: String, default: "" },
    isPublic: { type: Boolean, default: true },
    likesCount: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Playlist", playlistSchema);