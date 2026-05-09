const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers');

beforeAll(async () => await connectTestDB());
afterEach(async () => await clearDB());
afterAll(async () => await disconnectTestDB());

// ─── Test utilities ──────────────────────────────────────────

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

// ─── Fixtures ────────────────────────────────────────────────
const userA = { first_name: 'Alice', last_name: 'A', username: 'alice', email: 'alice@test.com', password: 'pass1234' };
const userB = { first_name: 'Bob', last_name: 'B', username: 'bob', email: 'bob@test.com', password: 'pass1234' };

// ────────────────────────────────────────────────────────────
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
    expect(res.body.post.author).toBeDefined();
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

  it('should return 400 if content is missing', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No content.' });
    expect(res.statusCode).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────
describe('GET /api/posts (public)', () => {
  let token;
  beforeEach(async () => { token = await signupAndLogin(userA); });

  it('should return only published posts', async () => {
    // Create a draft (not published)
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Draft Post', content: 'This is a draft.' });

    // Create and publish a post
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
    expect(res.body.pagination.page).toBe(1);
  });

  it('should search by title', async () => {
    await createAndPublishPost(token, { title: 'JavaScript Tips', content: 'Some JS content.' });
    await createAndPublishPost(token, { title: 'Python Guide', content: 'Python content here.' });

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

  it('should sort by like_count', async () => {
    const res = await request(app).get('/api/posts?sort=like_count');
    expect(res.statusCode).toBe(200);
  });

  it('should sort by comment_count', async () => {
    const res = await request(app).get('/api/posts?sort=comment_count');
    expect(res.statusCode).toBe(200);
  });

  it('should sort by timestamp', async () => {
    const res = await request(app).get('/api/posts?sort=timestamp');
    expect(res.statusCode).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────
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

  it('should return 404 for a draft post accessed by non-owner', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Secret Draft', content: 'Private.' });
    const draftId = createRes.body.post._id;

    const res = await request(app).get(`/api/posts/${draftId}`);
    expect(res.statusCode).toBe(404);
  });

  it('should allow owner to view their own draft', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My Draft', content: 'Only for me.' });
    const draftId = createRes.body.post._id;

    const res = await request(app)
      .get(`/api/posts/${draftId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  it('should return 400 for an invalid post ID', async () => {
    const res = await request(app).get('/api/posts/not-an-id');
    expect(res.statusCode).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────
describe('PATCH /api/posts/:id (edit)', () => {
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

  it('should not allow a non-owner to edit the post', async () => {
    const res = await request(app)
      .patch(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Stolen Edit' });
    expect(res.statusCode).toBe(403);
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).patch(`/api/posts/${postId}`).send({ title: 'Anon' });
    expect(res.statusCode).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────
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

  it('should return 404 after deletion', async () => {
    await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    const res = await request(app).get(`/api/posts/${postId}`);
    expect(res.statusCode).toBe(404);
  });
});

// ────────────────────────────────────────────────────────────
describe('GET /api/posts/me', () => {
  let token;
  beforeEach(async () => { token = await signupAndLogin(userA); });

  it('should return all of the owner\'s posts (draft + published)', async () => {
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Draft 1', content: 'Draft content.' });
    await createAndPublishPost(token, { title: 'Published 1', content: 'Pub content.' });

    const res = await request(app)
      .get('/api/posts/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.posts.length).toBe(2);
  });

  it('should filter by state=draft', async () => {
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Draft Only', content: 'Draft.' });
    await createAndPublishPost(token, { title: 'Published', content: 'Pub.' });

    const res = await request(app)
      .get('/api/posts/me?state=draft')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.posts.length).toBe(1);
    expect(res.body.posts[0].state).toBe('draft');
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).get('/api/posts/me');
    expect(res.statusCode).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────
describe('Like / Unlike', () => {
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
    await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);

    const res = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.statusCode).toBe(409);
  });

  it('should allow unliking a post', async () => {
    await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);

    const res = await request(app)
      .delete(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.like_count).toBe(0);
  });

  it('should return 404 when unliking a post not liked', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.statusCode).toBe(404);
  });
});

// ────────────────────────────────────────────────────────────
describe('GET /api/posts/feed', () => {
  let tokenA, tokenB;
  beforeEach(async () => {
    tokenA = await signupAndLogin(userA);
    tokenB = await signupAndLogin(userB);
  });

  it('should return posts from followed users + own posts', async () => {
    // B creates a published post
    await createAndPublishPost(tokenB, { title: 'Bob\'s Post', content: 'From Bob.' });

    // Get B's user ID
    const bProfile = await request(app)
      .get('/api/users/bob')
      .set('Authorization', `Bearer ${tokenA}`);
    const bobId = bProfile.body.user._id;

    // A follows B
    await request(app)
      .post(`/api/users/${bobId}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    const feedRes = await request(app)
      .get('/api/posts/feed')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(feedRes.statusCode).toBe(200);
    expect(feedRes.body.posts.some((p) => p.title === "Bob's Post")).toBe(true);
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).get('/api/posts/feed');
    expect(res.statusCode).toBe(401);
  });
});
