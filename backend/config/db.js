const { logger } = require('../logger');
const mongoose = require('mongoose');
require('dotenv').config();

module.exports = async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info('MongoDB connecté');
};
