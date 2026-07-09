const Playlist = require("../models/Playlist");
const User = require("../models/User");

const createPlaylist = async (req, res) => {
  try {
    const { name, description, isPublic, coverImage } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Playlist name is required" });
    }

    const playlist = await Playlist.create({
      name,
      description,
      isPublic: isPublic !== undefined ? isPublic : true,
      coverImage: coverImage || "",
      owner: req.user._id,
      songs: [],
    });

    await User.findByIdAndUpdate(req.user._id, { $push: { playlists: playlist._id } });

    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ owner: req.user._id }).populate(
      "songs",
      "title artist coverImage duration"
    );
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPlaylistById = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate("songs")
      .populate("owner", "name avatar");

    if (!playlist) return res.status(404).json({ message: "Playlist not found" });

    if (!playlist.isPublic && (!req.user || playlist.owner._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: "This playlist is private" });
    }

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: "Playlist not found" });

    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to edit this playlist" });
    }

    playlist.name = req.body.name || playlist.name;
    playlist.description = req.body.description ?? playlist.description;
    playlist.coverImage = req.body.coverImage ?? playlist.coverImage;
    if (req.body.isPublic !== undefined) playlist.isPublic = req.body.isPublic;

    const updated = await playlist.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addSongToPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: "Playlist not found" });

    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to edit this playlist" });
    }

    const { songId } = req.params;
    if (playlist.songs.some((s) => s.toString() === songId)) {
      return res.status(400).json({ message: "Song already in playlist" });
    }

    playlist.songs.push(songId);
    await playlist.save();

    const updated = await Playlist.findById(req.params.id).populate("songs");
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeSongFromPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: "Playlist not found" });

    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to edit this playlist" });
    }

    playlist.songs = playlist.songs.filter((s) => s.toString() !== req.params.songId);
    await playlist.save();

    const updated = await Playlist.findById(req.params.id).populate("songs");
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: "Playlist not found" });

    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this playlist" });
    }

    await playlist.deleteOne();
    await User.findByIdAndUpdate(req.user._id, { $pull: { playlists: playlist._id } });

    res.json({ message: "Playlist deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleLikePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: "Playlist not found" });

    const userId = req.user._id;
    const alreadyLiked = playlist.likedBy.some((id) => id.toString() === userId.toString());

    if (alreadyLiked) {
      playlist.likedBy = playlist.likedBy.filter((id) => id.toString() !== userId.toString());
      playlist.likesCount = Math.max(0, playlist.likesCount - 1);
    } else {
      playlist.likedBy.push(userId);
      playlist.likesCount += 1;
    }

    await playlist.save();
    res.json({ liked: !alreadyLiked, likesCount: playlist.likesCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPublicPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ isPublic: true })
      .populate("owner", "name avatar")
      .sort({ likesCount: -1, createdAt: -1 })
      .limit(50);
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createPlaylist,
  getMyPlaylists,
  getPlaylistById,
  updatePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  deletePlaylist,
  toggleLikePlaylist,
  getPublicPlaylists,
};