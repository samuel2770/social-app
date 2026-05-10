const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers');

beforeAll(async () => await connectTestDB());
afterEach(async () => await clearDB());
afterAll(async () => await disconnectTestDB());

const userA = { first_name: 'Alice', last_name: 'A', username: 'alice', email: 'alice@test.com', password: 'pass1234' };
const userB = { first_name: 'Bob', last_name: 'B', username: 'bob', email: 'bob@test.com', password: 'pass1234' };

const signupAndLogin = async (userData) => {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app)
    .post('/api/auth/signin')
    .send({ email: userData.email, password: userData.password });
  return res.body.token;
};

const createAndPublishPost = async (token, postData = {}) => {
  const createRes = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Test Post', content: 'Hello world content here.', tags: ['test'], ...postData });
  const postId = createRes.body.post._id;
  await request(app)
    .patch(`/api/posts/${postId}/publish`)
    .set('Authorization', `Bearer ${token}`);
  return postId;
};

describe('POST /api/posts', () => {
  let token;
  beforeEach(async () => { token = await signupAndLogin(userA); });

  it('should create a post in draft state', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My First Post', content: 'Some content.' });
    expect(res.statusCode).toBe(201);
    expect(res.body.post.state).toBe('draft');
  });

  it('should return 401 if not authenticated', async () => {
    const res = await request(app).post('/api/posts').send({ title: 'X', content: 'Y' });
    expect(res.statusCode).toBe(401);
  });

  it('should return 400 if title is missing', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'No title.' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/posts', () => {
  let token;
  beforeEach(async () => { token = await signupAndLogin(userA); });

  it('should return only published posts', async () => {
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Draft Post', content: 'This is a draft.' });
    await createAndPublishPost(token, { title: 'Published Post', content: 'Visible to all.' });
    const res = await request(app).get('/api/posts');
    expect(res.statusCode).toBe(200);
    expect(res.body.posts.length).toBe(1);
    expect(res.body.posts[0].title).toBe('Published Post');
  });

  it('should work without authentication', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return pagination metadata', async () => {
    const res = await request(app).get('/api/posts?page=1&limit=5');
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.limit).toBe(5);
  });

  it('should search by title', async () => {
    await createAndPublishPost(token, { title: 'JavaScript Tips', content: 'Some JS content.' });
    await createAndPublishPost(token, { title: 'Python Guide', content: 'Python content.' });
    const res = await request(app).get('/api/posts?search=JavaScript');
    expect(res.body.posts.length).toBe(1);
    expect(res.body.posts[0].title).toBe('JavaScript Tips');
  });

  it('should filter by tag', async () => {
    await createAndPublishPost(token, { title: 'Tagged Post', content: 'Content.', tags: ['nodejs'] });
    await createAndPublishPost(token, { title: 'Other Post', content: 'Content.', tags: ['python'] });
    const res = await request(app).get('/api/posts?tag=nodejs');
    expect(res.body.posts.length).toBe(1);
  });
});

describe('GET /api/posts/:id', () => {
  let token, postId;
  beforeEach(async () => {
    token = await signupAndLogin(userA);
    postId = await createAndPublishPost(token);
  });

  it('should return a published post with author info', async () => {
    const res = await request(app).get(`/api/posts/${postId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.post.author.username).toBe('alice');
  });

  it('should return 404 for a draft accessed by non-owner', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Secret Draft', content: 'Private.' });
    const draftId = createRes.body.post._id;
    const res = await request(app).get(`/api/posts/${draftId}`);
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /api/posts/:id', () => {
  let tokenA, tokenB, postId;
  beforeEach(async () => {
    tokenA = await signupAndLogin(userA);
    tokenB = await signupAndLogin(userB);
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Original', content: 'Original content.' });
    postId = res.body.post._id;
  });

  it('should allow the owner to edit the post', async () => {
    const res = await request(app)
      .patch(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Updated Title' });
    expect(res.statusCode).toBe(200);
    expect(res.body.post.title).toBe('Updated Title');
  });

  it('should not allow a non-owner to edit', async () => {
    const res = await request(app)
      .patch(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Stolen Edit' });
    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /api/posts/:id/publish', () => {
  let tokenA, tokenB, postId;
  beforeEach(async () => {
    tokenA = await signupAndLogin(userA);
    tokenB = await signupAndLogin(userB);
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'To Publish', content: 'Ready.' });
    postId = res.body.post._id;
  });

  it('should allow the owner to publish a draft', async () => {
    const res = await request(app)
      .patch(`/api/posts/${postId}/publish`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.post.state).toBe('published');
  });

  it('should not allow a non-owner to publish', async () => {
    const res = await request(app)
      .patch(`/api/posts/${postId}/publish`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/posts/:id', () => {
  let tokenA, tokenB, postId;
  beforeEach(async () => {
    tokenA = await signupAndLogin(userA);
    tokenB = await signupAndLogin(userB);
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'To Delete', content: 'Bye.' });
    postId = res.body.post._id;
  });

  it('should allow the owner to delete a post', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should not allow a non-owner to delete', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.statusCode).toBe(403);
  });
});

describe('Like and Unlike', () => {
  let tokenA, tokenB, postId;
  beforeEach(async () => {
    tokenA = await signupAndLogin(userA);
    tokenB = await signupAndLogin(userB);
    postId = await createAndPublishPost(tokenA);
  });

  it('should allow a user to like a post', async () => {
    const res = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.like_count).toBe(1);
  });

  it('should not allow liking the same post twice', async () => {
    await request(app).post(`/api/posts/${postId}/like`).set('Authorization', `Bearer ${tokenB}`);
    const res = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.statusCode).toBe(409);
  });

  it('should allow unliking a post', async () => {
    await request(app).post(`/api/posts/${postId}/like`).set('Authorization', `Bearer ${tokenB}`);
    const res = await request(app)
      .delete(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.like_count).toBe(0);
  });
});