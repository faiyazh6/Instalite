// add_users.js
import { createUser } from './users.js';

const users = [
  {
    login: 'alice',
    password: 'password123',
    email: 'alice@email.com',
    firstName: 'Alice',
    lastName: 'Wonder',
    birthday: '2000-01-01',
    affiliation: 'UPenn',
    profile_image_url: '',
    hashtag_text: ['#test']
  },
  {
    login: 'bob',
    password: 'password123',
    email: 'bob@email.com',
    firstName: 'Bob',
    lastName: 'Builder',
    birthday: '2000-01-01',
    affiliation: 'UPenn',
    profile_image_url: '',
    hashtag_text: ['#test']
  },
  {
    login: 'charlie',
    password: 'password123',
    email: 'charlie@email.com',
    firstName: 'Charlie',
    lastName: 'Chaplin',
    birthday: '2000-01-01',
    affiliation: 'UPenn',
    profile_image_url: '',
    hashtag_text: ['#test']
  }
];

for (const u of users) {
  const result = await createUser(u);
  console.log(result);
}
