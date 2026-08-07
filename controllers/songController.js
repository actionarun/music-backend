const fs = require("fs");
const path = require("path");
const Song = require("../models/Song");
const User = require("../models/User");


const createSong = async (req, res) => {
  try {
    const { title, artist, album, movie, genre, duration, releaseYear, downloadable } = req.body;

    if (!title || !artist) {
      return res.status(400).json({ message: "Title and artist are required" });
    }
    if (!req.files || !req.files.audioFile) {
      return res.status(400).json({ message: "Audio file is required" });
    }

    // Cloudinary returns the full hosted URL in file.path
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

    res.json({
      songs,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
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
      $or: [
        { title: regex },
        { artist: regex },
        { album: regex },
        { movie: regex },
      ],
    }).limit(50);

    res.json(songs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSongById = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id).populate(
      "comments.user",
      "name avatar"
    );
    if (!song) return res.status(404).json({ message: "Song not found" });
    res.json(song);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const streamSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });

    // Redirect to the Cloudinary-hosted file — Cloudinary handles range requests natively
    res.redirect(song.audioFile);

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

    res.redirect(song.audioFile);
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

    const updatedSong = await Song.findById(req.params.id).populate(
      "comments.user",
      "name avatar"
    );

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
  streamSong,
  downloadSong,
  toggleLikeSong,
  addComment,
  deleteComment,
};