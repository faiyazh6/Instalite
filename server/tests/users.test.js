import { expect, jest } from '@jest/globals';
import bcrypt from 'bcrypt';

import {
  createUser,
  authenticateUser,
  getUserById,
  updateUserEmail,
  updateUserPassword,
  updateHashtags,
  setUserOnlineStatus,
  getTopHashtags,
} from '../../users.js';

// Helper to generate a unique user
function generateUserInfo(overrides = {}) {
  const suffix = Date.now() + Math.floor(Math.random() * 10000);
  return {
    login: `testuser_${suffix}`,
    password: 'password123',
    firstName: 'Stefan',
    lastName: 'Matic',
    email: `user${suffix}@example.com`,
    affiliation: 'Penn',
    birthday: '2005-11-15',
    hashtags: ["#cis","#nets"],
    ...overrides
  };
}

test('createUser registers a new user with hashed password', async () => {
  const userInfo = generateUserInfo();
  const res = await createUser(userInfo);
  expect(res.success).toBe(true);
  expect(res.userId).toBeDefined();

  const userRecord = await getUserById(res.userId);
  expect(userRecord.hashed_password).not.toBe("password123");
});

test('authenticateUser returns token on valid credentials', async () => {
  const userInfo = generateUserInfo();
  const createRes = await createUser(userInfo);
  const res = await authenticateUser({ login: userInfo.login, password: userInfo.password });
  expect(res.success).toBe(true);
  expect(res.token).toBeDefined();
  expect(res.userId).toBeDefined();
  expect(res.is_online).toBe(true);
});

test('getUserById returns correct user info', async () => {
  const userInfo = generateUserInfo();
  const createRes = await createUser(userInfo);
  const auth = await authenticateUser({ login: userInfo.login, password: userInfo.password });
  const user = await getUserById(auth.userId);
  expect(user).not.toBeNull();
  expect(user.username).toBe(userInfo.login);
});

test('updateUserEmail updates the email on an existing user record', async () => {
  const userInfo = generateUserInfo();
  const createRes = await createUser(userInfo);
  const auth = await authenticateUser({ login: userInfo.login, password: userInfo.password });
  const newEmail = `new_${userInfo.email}`;
  const res = await updateUserEmail(auth.userId, newEmail);
  expect(res.success).toBe(true);
  const updatedUser = await getUserById(auth.userId);
  expect(updatedUser.email).toBe(newEmail);
});

test('updateUserPassword updates password and reverts to original', async () => {
  const userInfo = generateUserInfo();
  const createRes = await createUser(userInfo);
  const authBefore = await authenticateUser({ login: userInfo.login, password: userInfo.password });
  const userBefore = await getUserById(authBefore.userId);
  const originalHash = userBefore.hashed_password;

  const newPasswordPlainText = 'newpassword456';
  const newHashed = await bcrypt.hash(newPasswordPlainText, 10);
  const resUpdate = await updateUserPassword(authBefore.userId, newHashed);
  expect(resUpdate.success).toBe(true);

  const userAfter = await getUserById(authBefore.userId);
  const updatedHash = userAfter.hashed_password;
  expect(updatedHash).not.toBe(newPasswordPlainText);
  expect(updatedHash).not.toBe(originalHash);

  const revertHash = await bcrypt.hash(userInfo.password, 10);
  const revertRes = await updateUserPassword(authBefore.userId, revertHash);
  expect(revertRes.success).toBe(true);
});

test('updateHashtags updates user hashtags', async () => {
  const userInfo = generateUserInfo();
  const createRes = await createUser(userInfo);
  const auth = await authenticateUser({ login: userInfo.login, password: userInfo.password });
  const res = await updateHashtags(auth.userId, ['#phil', '#urbs']);
  expect(res.success).toBe(true);
  const updatedUser = await getUserById(auth.userId);
  const parsed = JSON.parse(updatedUser.hashtag_text);
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed).toEqual(expect.arrayContaining(['#phil', '#urbs']));
});

test('setUserOnlineStatus toggles online/offline correctly', async () => {
  const userInfo = generateUserInfo();
  const createRes = await createUser(userInfo);
  const auth = await authenticateUser({ login: userInfo.login, password: userInfo.password });

  let res = await setUserOnlineStatus(auth.userId, true);
  expect(res.success).toBe(true);
  let userRecord = await getUserById(auth.userId);
  expect(!!userRecord.is_online).toBe(true);

  res = await setUserOnlineStatus(auth.userId, false);
  expect(res.success).toBe(true);
  userRecord = await getUserById(auth.userId);
  expect(!!userRecord.is_online).toBe(false);
});

test('getTopHashtags returns the hashtag array for a user', async () => {
  const userInfo = generateUserInfo({ hashtags: ['#cis', '#nets'] });
  const createRes = await createUser(userInfo);
  expect(createRes.success).toBe(true);

  const tags = await getTopHashtags(createRes.userId);
  expect(Array.isArray(tags)).toBe(true);
  expect(tags).toEqual(expect.arrayContaining(['#cis', '#nets']));
});
