const mongoose = require('mongoose');
require('dotenv').config();

module.exports = async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connecté');
};
