const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
require("dotenv").config();

const { connectToMongoDB } = require("./connect");
const { checkAuth } = require("./middlewares/auth");
const userRoute = require("./routes/user");
const messageRoute = require("./routes/message");
const doctorRoute = require("./routes/doctor");
const appointmentRoute = require("./routes/appointment");

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

app.use(helmet());
app.use(mongoSanitize());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/uploads",
   express.static(path.join(__dirname, "uploads"),{
    setHeaders: (res) => {
      res.setHeader("Content-Disposition","inline");
      res.setHeader("x-content-Type-Options","nosniff");
    },
   })
  );

app.use("/user", userRoute);
app.use("/message", messageRoute);
app.use("/doctor", doctorRoute);
app.use("/appointment", appointmentRoute);

app.listen(PORT, () => console.log(`Server Started at PORT:${PORT}`));