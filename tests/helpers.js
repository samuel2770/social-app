const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

const connectTestDB = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.NODE_ENV = 'test';
  await mongoose.connect(uri);
};

const clearDB = async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

const disconnectTestDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
};

module.exports = { connectTestDB, clearDB, disconnectTestDB };