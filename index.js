const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const { connectToMongoDB } = require("./connect");
const { restrictToLoggedinUserOnly, checkAuth } = require("./middlewares/auth");
const staticRoute = require("./routes/staticRouter");
const userRoute = require("./routes/user");

const app = express();
const PORT = 8001;

connectToMongoDB(process.env.MONGODB ?? "mongodb://localhost:27017/Signup_data").then(() =>
  console.log("Mongodb connected")
);

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


app.use("/user", userRoute);
app.use("/", checkAuth, staticRoute);



app.listen(PORT, () => console.log(`Server Started at PORT:${PORT}`));
