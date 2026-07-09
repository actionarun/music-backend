const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "audioFile") {
      cb(null, "uploads/songs");
    } else if (file.fieldname === "coverImage") {
      cb(null, "uploads/covers");
    } else {
      cb(null, "uploads");
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "audioFile") {
    const allowed = /mp3|wav|ogg|m4a/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (ext) return cb(null, true);
    return cb(new Error("Only audio files (mp3, wav, ogg, m4a) are allowed"));
  }
  if (file.fieldname === "coverImage") {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (ext) return cb(null, true);
    return cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed"));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

module.exports = upload;