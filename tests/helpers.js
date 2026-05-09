const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

/**
 * Starts an in-memory MongoDB instance and connects Mongoose.
 * Call in beforeAll().
 */
const connectTestDB = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.NODE_ENV = 'test';
  await mongoose.connect(uri);
};

/**
 * Drops all collections between tests for a clean slate.
 * Call in beforeEach() or afterEach().
 */
const clearDB = async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

/**
 * Disconnects Mongoose and stops the in-memory server.
 * Call in afterAll().
 */
const disconnectTestDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
};

module.exports = { connectTestDB, clearDB, disconnectTestDB };
