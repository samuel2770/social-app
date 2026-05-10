const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers');

beforeAll(async () => await connectTestDB());
afterEach(async () => await clearDB());
afterAll(async () => await disconnectTestDB());

const userA = { first_name: 'Alice', last_name: 'A', username: 'alice', email: 'alice@test.com', password: 'pass1234' };
const userB = { first_name: 'Bob', last_name: 'B', username: 'bob', email: 'bob@test.com', password: 'pass1234' };
const userC = { first_name: 'Carol', last_name: 'C', username: 'carol', email: 'carol@test.com', password: 'pass1234' };

const signupAndLogin = async (userData) => {
  const signupRes = await request(app).post('/api/auth/signup').send(userData);
  const userId = signupRes.body.user._id;
  const loginRes = await request(app)
    .post('/api/auth/signin')
    .send({ email: userData.email, password: userData.password });
  return { token: loginRes.body.token, userId };
};

describe('GET /api/users/:username', () => {
  it('should return a public user profile', async () => {
    await signupAndLogin(userA);
    const res = await request(app).get('/api/users/alice');
    expect(res.statusCode).toBe(200);
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.password).toBeUndefined();
  });

  it('should return 404 for a non-existent username', async () => {
    const res = await request(app).get('/api/users/nobody');
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/users/:id/follow', () => {
  let tokenA, aId, tokenB, bId;
  beforeEach(async () => {
    ({ token: tokenA, userId: aId } = await signupAndLogin(userA));
    ({ token: tokenB, userId: bId } = await signupAndLogin(userB));
  });

  it('should follow another user successfully', async () => {
    const res = await request(app)
      .post(`/api/users/${bId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should not allow following yourself', async () => {
    const res = await request(app)
      .post(`/api/users/${aId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(400);
  });

  it('should not allow following the same user twice', async () => {
    await request(app).post(`/api/users/${bId}/follow`).set('Authorization', `Bearer ${tokenA}`);
    const res = await request(app)
      .post(`/api/users/${bId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(409);
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).post(`/api/users/${bId}/follow`);
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /api/users/:id/follow', () => {
  let tokenA, tokenB, bId;
  beforeEach(async () => {
    ({ token: tokenA } = await signupAndLogin(userA));
    ({ token: tokenB, userId: bId } = await signupAndLogin(userB));
    await request(app).post(`/api/users/${bId}/follow`).set('Authorization', `Bearer ${tokenA}`);
  });

  it('should unfollow a user successfully', async () => {
    const res = await request(app)
      .delete(`/api/users/${bId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 if not currently following', async () => {
    await request(app).delete(`/api/users/${bId}/follow`).set('Authorization', `Bearer ${tokenA}`);
    const res = await request(app)
      .delete(`/api/users/${bId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/users/me/following', () => {
  let tokenA, bId, cId;
  beforeEach(async () => {
    ({ token: tokenA } = await signupAndLogin(userA));
    ({ userId: bId } = await signupAndLogin(userB));
    ({ userId: cId } = await signupAndLogin(userC));
    await request(app).post(`/api/users/${bId}/follow`).set('Authorization', `Bearer ${tokenA}`);
    await request(app).post(`/api/users/${cId}/follow`).set('Authorization', `Bearer ${tokenA}`);
  });

  it('should return a list of users I am following', async () => {
    const res = await request(app)
      .get('/api/users/me/following')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.users.length).toBe(2);
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).get('/api/users/me/following');
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/users/me/followers', () => {
  let tokenA, tokenB, tokenC;
  beforeEach(async () => {
    ({ token: tokenA } = await signupAndLogin(userA));
    ({ token: tokenB } = await signupAndLogin(userB));
    ({ token: tokenC } = await signupAndLogin(userC));
    const aProfile = await request(app).get('/api/users/alice');
    const aId = aProfile.body.user._id;
    await request(app).post(`/api/users/${aId}/follow`).set('Authorization', `Bearer ${tokenB}`);
    await request(app).post(`/api/users/${aId}/follow`).set('Authorization', `Bearer ${tokenC}`);
  });

  it('should return a list of my followers', async () => {
    const res = await request(app)
      .get('/api/users/me/followers')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.users.length).toBe(2);
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).get('/api/users/me/followers');
    expect(res.statusCode).toBe(401);
  });
});