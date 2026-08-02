const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required : true,
        },
        email: {
            type: String,
            Required :true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        age:{
            type: Number,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        address:{
            type: String,
            reuired : true,
        },

    },
    {timeStamp: true}
);

const User = mongoose.model("user", userSchema);

module.exports = User;