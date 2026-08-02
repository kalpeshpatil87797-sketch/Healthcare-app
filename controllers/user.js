const { v4: uuid4 } = require("uuid");
const User = require("../models/user");
const {setUser } = require("../service/auth");

async function handleUserSignup(req, res) {
    const { name,emai,password,age,phone,address} = req.body;
    await User.create({
        name,
        email,
        password,
        age,
        phone,
        address,
    });
    return res.redirect("/");
}

async function handleUserLogin(req, res) {
    const {email,password} = req.body;
    const User = await User.findOne({email,password});

    if(!User )
        return res.render("login",{
            error:"Invalid Username Or Password",
        });

    const sessionId = uuid4();
    setUser(sessionId, user);
    res.cookie("uid", sessionId);
    return res.redirect("/");
}

module.exports = {
    handleUserSignup,
    handleUserLogin,
};