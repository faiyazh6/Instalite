import {
  createPost,
  deletePost,
  likePost,
  unlikePost,
  getPostsForUser
} from '../../posts.js';

import {
  createUser,
  authenticateUser
} from '../../users.js';

let testUserId;
let testPostId;

beforeAll(async () => {
  // Create test user
  const user = {
    login: 'postuser',
    password: 'postpass123',
    firstName: 'Poster',
    lastName: 'McTest',
    email: 'poster@example.com',
    affiliation: 'Penn',
    birthday: '2002-02-02',
    hashtags: ['#intro']
  };
  await createUser(user);
  const auth = await authenticateUser({ login: 'postuser', password: 'postpass123' });
  testUserId = auth.userId;
});

// ----------------------------------
// Test: createPost
// ----------------------------------
test('createPost creates a post with text and hashtags', async () => {
  const res = await createPost(testUserId, "My first test post 1", null, ["#test", "#jest"]);
  expect(res.success).toBe(true);
  expect(res.postId).toBeDefined();
  testPostId = res.postId;
});

// ----------------------------------
// Test: likePost
// ----------------------------------
test('likePost adds a like from the user', async () => {
  const res = await likePost(testPostId, testUserId);
  expect(res.success).toBe(true);

  const posts = await getPostsForUser(testUserId);
  const post = posts.find(p => p.postId === testPostId);
  expect(post.likeCount).toBe(1);  // Exactly one like, because only one user liked it
});

// ----------------------------------
// Test: unlikePost removes the like
// ----------------------------------
test('unlikePost removes the user’s like from the post', async () => {
  const res = await unlikePost(testPostId, testUserId);
  expect(res.success).toBe(true);

  const posts = await getPostsForUser(testUserId);
  const post = posts.find(p => p.postId === testPostId);
  expect(post.likeCount).toBe(0);  // Should be back to zero after unliking
});

// ----------------------------------
// Test: getPostsForUser retrieves the user’s own post
// ----------------------------------
test('getPostsForUser retrieves user’s own post correctly', async () => {
  const posts = await getPostsForUser(testUserId);
  expect(Array.isArray(posts)).toBe(true);
  expect(posts.length).toBeGreaterThan(0);

  const post = posts.find(p => p.postId === testPostId);
  expect(post).toBeDefined();
  expect(post.text).toBe("My first test post 1");
  expect(post.author).toBeDefined();
});

// ----------------------------------
// Test: deletePost removes post if user is the author
// ----------------------------------
test('deletePost deletes the post if the user is the author', async () => {
  const res = await deletePost(testPostId, testUserId);
  expect(res.success).toBe(true);

  const posts = await getPostsForUser(testUserId);
  const found = posts.find(p => p.postId === testPostId);
  expect(found).toBeUndefined();
});