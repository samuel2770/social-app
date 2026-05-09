const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers');

beforeAll(async () => await connectTestDB());
afterEach(async () => await clearDB());
afterAll(async () => await disconnectTestDB());

// ─── Fixtures ────────────────────────────────────────────────
const validUser = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  username: 'ada_lovelace',
  email: 'ada@example.com',
  password: 'password123',
};

describe('POST /api/auth/signup', () => {
  it('should register a new user and return a token', async () => {
    const res = await request(app).post('/api/auth/signup').send(validUser);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.body.user.password).toBeUndefined(); // Never expose password
  });

  it('should reject signup with a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send(validUser);
    const res = await request(app).post('/api/auth/signup').send(validUser);
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should reject signup with a duplicate username', async () => {
    await request(app).post('/api/auth/signup').send(validUser);
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...validUser, email: 'other@example.com' });
    expect(res.statusCode).toBe(409);
  });

  it('should reject signup with missing required fields', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'test@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject an invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...validUser, email: 'not-an-email' });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/signin', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/signup').send(validUser);
  });

  it('should sign in with valid credentials and return a token', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.expires_in).toBe('1h');
  });

  it('should reject signin with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: validUser.email, password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject signin with unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'ghost@example.com', password: 'password123' });
    expect(res.statusCode).toBe(401);
  });

  it('should reject signin with missing fields', async () => {
    const res = await request(app).post('/api/auth/signin').send({ email: validUser.email });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/signup').send(validUser);
    token = res.body.token;
  });

  it('should return the current user profile when authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.body.user.password).toBeUndefined();
  });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('should return 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.statusCode).toBe(401);
  });
});
