const mongoose = require('mongoose')

async function connectMongoDb(url) {
    try {
        await mongoose.connect(url)
        console.log("Connection to MonogoDB successful");
    }
    catch (err) {
        console.error("MongoDB connection error:", err)
    }
}
module.exports={connectMongoDb}