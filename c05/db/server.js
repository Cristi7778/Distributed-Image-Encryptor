const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const app = express();
app.use(cors());

// We need to parse raw BMP bytes; limit can be adjusted as needed.
app.use("/upload-enc", express.raw({ type: "image/bmp", limit: "50mb" }));
app.use("/upload-dec", express.raw({ type: "image/bmp", limit: "50mb" }));

const {
  DB_HOST = "localhost",
  DB_USER = "picuser",
  DB_PASS = "picpass",
  DB_NAME = "picturesdb",
} = process.env;

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function storeRawBmp(req, res, type) {
  try {
    const bmpBuffer = req.body;
    if (!Buffer.isBuffer(bmpBuffer) || bmpBuffer.length === 0) {
      return res.status(400).json({ error: "No BMP data in request body" });
    }

    const [result] = await pool.execute(
      `INSERT INTO pictures (type, data) VALUES (?, ?);`,
      [type, bmpBuffer]
    );
    const newId = result.insertId;
    const fetchUrl = `${req.protocol}://${req.get("host")}/pictures/${newId}`;

    return res.status(201).json({
      id: newId,
      url: fetchUrl,
      type,
      message: "Picture stored successfully",
    });
  } catch (err) {
    console.error("Upload Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

app.post("/upload-enc", (req, res) => {
  return storeRawBmp(req, res, "enc");
});

app.post("/upload-dec", (req, res) => {
  return storeRawBmp(req, res, "dec");
});

app.get("/pictures/:id", async (req, res) => {
  try {
    const picId = parseInt(req.params.id, 10);
    if (isNaN(picId)) {
      return res.status(400).send("Invalid picture ID");
    }

    const [rows] = await pool.execute(
      `SELECT type, data FROM pictures WHERE id = ?;`,
      [picId]
    );
    if (rows.length === 0) {
      return res.status(404).send("Picture not found");
    }

    const { data } = rows[0];
    res.setHeader("Content-Type", "image/bmp");
    return res.send(data);
  } catch (err) {
    console.error("Fetch Error:", err);
    return res.status(500).send("Internal Server Error");
  }
});

app.get("/pictures", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, type, created_at FROM pictures ORDER BY id DESC;`
    );
    return res.json(rows);
  } catch (err) {
    console.error("List Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.use((req, res) => {
  res.status(404).send("Not Found");
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Node.js server listening on port ${PORT}`);
});
