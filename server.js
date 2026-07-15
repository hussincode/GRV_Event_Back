require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");


const registerRouter = require("./routes/register");
const adminRouter = require("./routes/admin");
const registrationsRouter = require("./routes/registrations");
const checkinRouter = require("./routes/checkin");


const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Expose uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", registerRouter);
app.use("/api", adminRouter);
app.use("/api", registrationsRouter);
app.use("/api", checkinRouter);


if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`GRV Event Portal server listening on port ${PORT}`);
  });
}

module.exports = app;

