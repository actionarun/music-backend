const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const songSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    artist: { type: String, required: true, trim: true, index: true },
    album: { type: String, trim: true, index: true },
    movie: { type: String, trim: true, index: true },
    genre: { type: String, trim: true, index: true },
    duration: { type: Number, default: 0 },
    coverImage: { type: String, default: "" },
    audioFile: { type: String, required: true },
    downloadable: { type: Boolean, default: true },
    plays: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],
    releaseYear: { type: Number },
  },
  { timestamps: true }
);

songSchema.index({ title: "text", artist: "text", album: "text", movie: "text" });

module.exports = mongoose.model("Song", songSchema);