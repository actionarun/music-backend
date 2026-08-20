const fs = require("fs");
const path = require("path");
const axios = require("axios");
const Song = require("../models/Song");
const User = require("../models/User");
const Playlist = require("../models/Playlist");

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

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
      uploadedBy: req.user._id, // ownership always comes from the authenticated user, never from the request body
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
    if (!q) return res.status(400).json({ message: "Search query 'q' is required" });

    const regex = new RegExp(q, "i");
    const songs = await Song.find({
      $or: [{ title: regex }, { artist: regex }, { album: regex }, { movie: regex }],
    }).limit(50);

    res.json(songs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// NEW — GET /api/songs/mine/uploaded — songs uploaded by the logged-in user only
const getMySongs = async (req, res) => {
  try {
    const songs = await Song.find({ uploadedBy: req.user._id }).sort({ createdAt: -1 });
    res.json(songs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// NEW — GET /api/songs/mine/liked — full song details for the logged-in user's liked songs
const getLikedSongs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("likedSongs");
    res.json(user.likedSongs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSongById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid song ID" });

    const song = await Song.findById(id).populate("comments.user", "name avatar");
    if (!song) return res.status(404).json({ message: "Song not found" });
    res.json(song);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Ownership check helper — strict: uploadedBy must exist AND match the authenticated user
const assertOwnership = (song, userId) => {
  return song.uploadedBy && song.uploadedBy.toString() === userId.toString();
};

const updateSong = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid song ID" });

    const song = await Song.findById(id);
    if (!song) return res.status(404).json({ message: "Song not found" });

    if (!assertOwnership(song, req.user._id)) {
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

const deleteSong = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid song ID" });

    const song = await Song.findById(id);
    if (!song) return res.status(404).json({ message: "Song not found" });

    if (!assertOwnership(song, req.user._id)) {
      return res.status(403).json({ message: "Not authorized to delete this song" });
    }

    await song.deleteOne();
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

    if (song.audioFile.startsWith("http")) {
      Song.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } }).exec();
      return res.redirect(song.audioFile);
    }

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

// FIXED — proxy-streams the file through our backend instead of redirecting,
// so the browser only ever talks to our (authenticated) API, never directly to Cloudinary.
// This is what makes the Authorization header meaningful for downloads.
const downloadSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });
    if (!song.downloadable) {
      return res.status(403).json({ message: "This song is not available for download" });
    }

    const safeName = `${song.artist} - ${song.title}`.replace(/[^\w\s-]/g, "");

    if (song.audioFile.startsWith("http")) {
      const response = await axios.get(song.audioFile, { responseType: "stream" });
      const ext = song.audioFile.split(".").pop().split("?")[0] || "mp3";
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.${ext}"`);
      res.setHeader("Content-Type", response.headers["content-type"] || "audio/mpeg");
      response.data.pipe(res);
      return;
    }

    const filePath = path.join(__dirname, "..", song.audioFile);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Audio file not found on server" });
    }
    res.download(filePath, `${safeName}${path.extname(filePath)}`);
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
    if (!text || !text.trim()) return res.status(400).json({ message: "Comment text is required" });

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
};