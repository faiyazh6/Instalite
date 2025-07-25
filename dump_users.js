// dump_users.js
import { get_db_connection } from './server/models/rdbms.js';

const db = get_db_connection();

await db.connect();

const [rows] = await db.send_sql(`SELECT * FROM users`);

console.log("=== All Registered Users ===");
for (const user of rows) {
  console.log({
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    affiliation: user.affiliation,
    hashtags: user.hashtag_text,
    is_online: user.is_online
  });
}

process.exit();
