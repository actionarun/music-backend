const fs = require("fs");
const path = require("path");
const Song = require("../models/Song");
const User = require("../models/User");
const Playlist = require("../models/Playlist");

const createSong = async (req, res) => {
  try {
    const { title, artist, album, movie, genre, duration, releaseYear, downloadable } = req.body;

    if (!title || !artist) {
      return res.status(400).json({ message: "Title and artist are required" });
    }
    if (!req.files || !req.files.audioFile) {
      return res.status(400).json({ message: "Audio file is required" });
    }

    const audioFile = req.files.audioFile[0].path;
    const coverImage = req.files.coverImage ? req.files.coverImage[0].path : "";

    const song = await Song.create({
      title,
      artist,
      album,
      movie,
      genre,
      duration,
      releaseYear,
      downloadable: downloadable !== "false",
      audioFile,
      coverImage,
      uploadedBy: req.user._id,
    });

    res.status(201).json(song);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSongs = async (req, res) => {
  try {
    const { genre, page = 1, limit = 20 } = req.query;
    const query = {};

    if (genre) {
      query.genre = genre;
    } else if (req.user && req.user.preferences && req.user.preferences.genres.length > 0) {
      query.genre = { $in: req.user.preferences.genres };
    }

    const songs = await Song.find(query)
      .sort({ plays: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Song.countDocuments(query);

    res.json({ songs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const searchSongs = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ message: "Search query 'q' is required" });
    }

    const regex = new RegExp(q, "i");

    const songs = await Song.find({
      $or: [{ title: regex }, { artist: regex }, { album: regex }, { movie: regex }],
    }).limit(50);

    res.json(songs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/songs/:id — handles invalid/missing IDs cleanly
const getSongById = async (req, res) => {
  try {
    const { id } = req.params;

    // Guard against malformed ObjectIds (prevents a 500 crash on bad URLs)
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid song ID" });
    }

    const song = await Song.findById(id).populate("comments.user", "name avatar");
    if (!song) return res.status(404).json({ message: "Song not found" });
    res.json(song);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/songs/:id — NEW: update song metadata
const updateSong = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid song ID" });
    }

    const song = await Song.findById(id);
    if (!song) return res.status(404).json({ message: "Song not found" });

    // Permission: only the uploader can edit. Legacy/seeded songs (no uploadedBy) are editable by any logged-in user.
    if (song.uploadedBy && song.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to edit this song" });
    }

    const editableFields = ["title", "artist", "album", "movie", "genre", "releaseYear", "downloadable"];
    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) song[field] = req.body[field];
    });

    const updated = await song.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/songs/:id — NEW: delete song + clean up references
const deleteSong = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid song ID" });
    }

    const song = await Song.findById(id);
    if (!song) return res.status(404).json({ message: "Song not found" });

    if (song.uploadedBy && song.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this song" });
    }

    await song.deleteOne();

    // Clean up references so deleted songs don't linger in playlists/likes
    await Playlist.updateMany({ songs: id }, { $pull: { songs: id } });
    await User.updateMany({ likedSongs: id }, { $pull: { likedSongs: id } });

    res.json({ message: "Song deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const streamSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });

    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");

    // Cloudinary/external URLs — redirect and let the host serve the range request
    if (song.audioFile.startsWith("http")) {
      Song.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } }).exec();
      return res.redirect(song.audioFile);
    }

    // Legacy local file fallback
    const filePath = path.join(__dirname, "..", song.audioFile);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Audio file not found on server" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "audio/mpeg",
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
      });
      fs.createReadStream(filePath).pipe(res);
    }

    Song.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } }).exec();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const downloadSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });
    if (!song.downloadable) {
      return res.status(403).json({ message: "This song is not available for download" });
    }

    if (song.audioFile.startsWith("http")) {
      return res.redirect(song.audioFile);
    }

    const filePath = path.join(__dirname, "..", song.audioFile);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Audio file not found on server" });
    }
    res.download(filePath, `${song.artist} - ${song.title}${path.extname(filePath)}`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleLikeSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });

    const userId = req.user._id;
    const alreadyLiked = song.likedBy.some((id) => id.toString() === userId.toString());

    if (alreadyLiked) {
      song.likedBy = song.likedBy.filter((id) => id.toString() !== userId.toString());
      song.likesCount = Math.max(0, song.likesCount - 1);
      await User.findByIdAndUpdate(userId, { $pull: { likedSongs: song._id } });
    } else {
      song.likedBy.push(userId);
      song.likesCount += 1;
      await User.findByIdAndUpdate(userId, { $addToSet: { likedSongs: song._id } });
    }

    await song.save();
    res.json({ liked: !alreadyLiked, likesCount: song.likesCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });

    song.comments.push({ user: req.user._id, text });
    await song.save();

    const updatedSong = await Song.findById(req.params.id).populate("comments.user", "name avatar");
    res.status(201).json(updatedSong.comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });

    const comment = song.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    comment.deleteOne();
    await song.save();
    res.json({ message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
};