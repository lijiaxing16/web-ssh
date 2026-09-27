const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const cacheDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(cacheDir, { recursive: true });
    cb(null, cacheDir);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, safeName);
  },
});

const upload = multer({ storage });

module.exports = { upload };
