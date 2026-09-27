const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 *1000,
    max:10,
    message:{error:"too many attempts,please try again later"},

});

module.exports = authLimiter;
