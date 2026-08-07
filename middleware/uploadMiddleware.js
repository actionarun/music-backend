const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    if (file.fieldname === "audioFile") {
      return {
        folder: "music-app/songs",
        resource_type: "video", // Cloudinary treats audio as "video" resource type
        allowed_formats: ["mp3", "wav", "ogg", "m4a"],
      };
    }
    if (file.fieldname === "coverImage") {
      return {
        folder: "music-app/covers",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
      };
    }
    return { folder: "music-app/misc" };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

module.exports = upload;