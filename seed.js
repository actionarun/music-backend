const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Song = require("./models/Song");

dotenv.config();

const sampleSongs = [
  {
    title: "Sunset Drive",
    artist: "SoundHelix",
    album: "Demo Collection",
    genre: "EDM",
    duration: 180,
    audioFile: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    coverImage: "",
    releaseYear: 2023,
  },
  {
    title: "Morning Coffee",
    artist: "SoundHelix",
    album: "Demo Collection",
    genre: "Pop",
    duration: 200,
    audioFile: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    coverImage: "",
    releaseYear: 2023,
  },
  {
    title: "City Lights",
    artist: "SoundHelix",
    album: "Demo Collection",
    genre: "Rock",
    duration: 210,
    audioFile: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    coverImage: "",
    releaseYear: 2023,
  },
  {
    title: "Quiet Nights",
    artist: "SoundHelix",
    album: "Demo Collection",
    genre: "Classical",
    duration: 195,
    audioFile: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    coverImage: "",
    releaseYear: 2023,
  },
  {
    title: "Open Road",
    artist: "SoundHelix",
    album: "Demo Collection",
    genre: "Indie",
    duration: 175,
    audioFile: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    coverImage: "",
    releaseYear: 2023,
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    await Song.deleteMany({ artist: "SoundHelix" }); // clear old seed data, avoid duplicates
    await Song.insertMany(sampleSongs);

    console.log(`Inserted ${sampleSongs.length} songs successfully`);
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exit(1);
  }
};

seed();