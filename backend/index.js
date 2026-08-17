const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const { connectToMongoDB } = require("./connect");
const { checkAuth } = require("./middlewares/auth");
const userRoute = require("./routes/user");
const messageRoute = require("./routes/message");

const app = express();
const PORT = 8001;

connectToMongoDB(process.env.MONGODB ?? "mongodb://localhost:27017/Signup_data").then(() =>
  console.log("Mongodb connected")
);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/user", userRoute);
app.use("/message", messageRoute);

app.listen(PORT, () => console.log(`Server Started at PORT:${PORT}`));