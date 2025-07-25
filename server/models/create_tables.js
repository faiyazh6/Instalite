import { get_db_connection, RelationalDB } from '../models/rdbms.js';
const dbaccess = get_db_connection();

function sendQueryOrCommand(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.query(query, params, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }

async function create_tables() {

await dbaccess.create_tables("SET FOREIGN_KEY_CHECKS = 0;");

await dbaccess.create_tables("DROP TABLE IF EXISTS chat_invites;");
await dbaccess.create_tables("DROP TABLE IF EXISTS chat_messages;");
await dbaccess.create_tables("DROP TABLE IF EXISTS chat_sessions;");
await dbaccess.create_tables("DROP TABLE IF EXISTS comments;");
await dbaccess.create_tables("DROP TABLE IF EXISTS posts;");
await dbaccess.create_tables("DROP TABLE IF EXISTS friends;");
await dbaccess.create_tables("DROP TABLE IF EXISTS hashtags;");
await dbaccess.create_tables("DROP TABLE IF EXISTS users;");
await dbaccess.create_tables("DROP TABLE IF EXISTS post_likes;");
await dbaccess.create_tables("DROP TABLE IF EXISTS comment_likes;");
await dbaccess.create_tables("DROP TABLE IF EXISTS names;");
await dbaccess.create_tables("DROP TABLE IF EXISTS principals;");
await dbaccess.create_tables("DROP TABLE IF EXISTS titles;");


await dbaccess.create_tables("SET FOREIGN_KEY_CHECKS = 1;");

  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS users ( \
    user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, \
    username VARCHAR(255) UNIQUE, \
    hashed_password VARCHAR(255), \
    email VARCHAR(255) UNIQUE, \
    first_name VARCHAR(255), \
    last_name VARCHAR(255), \
    birthday DATE, \
    affiliation VARCHAR(255), \
    profile_image_url TEXT, \
    linked_actor_id VARCHAR(255), \
    hashtag_text JSON, \
    is_online BOOLEAN DEFAULT FALSE \
  );');

  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS friends ( \
    follower INT, \
    following INT, \
    PRIMARY KEY (follower, following), \
    FOREIGN KEY (follower) REFERENCES users(user_id), \
    FOREIGN KEY (following) REFERENCES users(user_id), \
    CONSTRAINT chk_no_self_follow CHECK (follower <> following) \
    );')

  await dbaccess.create_tables("CREATE TABLE IF NOT EXISTS posts ( \
    post_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, \
    author INT, \
    text_content TEXT, \
    image_url TEXT, \
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
    comment_id INT, \
    is_external BOOLEAN DEFAULT FALSE, \
    external_site_id VARCHAR(255), \
    file_key VARCHAR(255), \
    hashtag_text JSON, \
    FOREIGN KEY (author) REFERENCES users(user_id) \
  );");

  await dbaccess.create_tables("CREATE TABLE IF NOT EXISTS hashtags ( \
    hashtag VARCHAR(255) PRIMARY KEY, \
    count INT DEFAULT 0 \
  );");

  await dbaccess.create_tables("CREATE TABLE IF NOT EXISTS chat_sessions ( \
    chat_session_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, \
    creation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
    chat_members TEXT, \
    chat_name VARCHAR(255) DEFAULT NULL \
  );");

  await dbaccess.create_tables(`CREATE TABLE IF NOT EXISTS chat_messages (
    message_id       INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_session_id  INT NOT NULL,
    user_id          INT NOT NULL,
    text_content     TEXT,
    timestamp        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_session_id)
      REFERENCES chat_sessions(chat_session_id)
      ON DELETE CASCADE,
    FOREIGN KEY (user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE
  );`);

  await dbaccess.create_tables("CREATE TABLE IF NOT EXISTS comments ( \
    comment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, \
    post_id INT, \
    user_id INT, \
    text_content TEXT, \
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
    parent_comment_id INT, \
    FOREIGN KEY (post_id) REFERENCES posts(post_id), \
    FOREIGN KEY (user_id) REFERENCES users(user_id), \
    FOREIGN KEY (parent_comment_id) REFERENCES comments(comment_id) \
  );");

  await dbaccess.create_tables(`CREATE TABLE IF NOT EXISTS chat_invites (
    invite_id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_user_id    INT NOT NULL,
    recipient_user_id INT NOT NULL,
    chat_session_id   INT NOT NULL,
    timestamp         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE,
    FOREIGN KEY (recipient_user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE,
    FOREIGN KEY (chat_session_id)
      REFERENCES chat_sessions(chat_session_id)
      ON DELETE CASCADE
  );`);

  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS names ( \
    nconst VARCHAR(255), \
    primaryName VARCHAR(255), \
    birthYear VARCHAR(4), \
    deathYear VARCHAR(4), \
    path TEXT \
    );');
  
    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS titles ( \
      tconst VARCHAR(255) PRIMARY KEY, \
      titleType VARCHAR(255), \
      primaryTitle VARCHAR(255), \
      originalTitle VARCHAR(255), \
      startYear INT, \
      endYear INT, \
      runtimeMinutes INT \
    );');    

    await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS principals (\
      tconst VARCHAR(255) NOT NULL, \
      ordering INT, \
      nconst VARCHAR(255) NOT NULL, \
      category VARCHAR(255), \
      job VARCHAR(255), \
      characters VARCHAR(255), \
      PRIMARY KEY (tconst, nconst), \
      FOREIGN KEY (tconst) REFERENCES titles(tconst)\
    );');    
  
  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS post_likes ( \
      post_id INT, \
      user_id INT, \
      PRIMARY KEY (post_id, user_id), \
      FOREIGN KEY (post_id) REFERENCES posts(post_id), \
      FOREIGN KEY (user_id) REFERENCES users(user_id) \);');
  
  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS comment_likes (\
      comment_id INT, \
      user_id INT, \
      PRIMARY KEY (comment_id, user_id), \
      FOREIGN KEY (comment_id) REFERENCES comments(comment_id), \
      FOREIGN KEY (user_id) REFERENCES users(user_id) \
    );'
  );

  await dbaccess.create_tables('CREATE TABLE IF NOT EXISTS reviews ( \
    review_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, \
    review TEXT, \
    sentiment VARCHAR(10) \
  );');
  
  
  return null;
}


console.log('Creating tables');

async function create_populate() {
  await dbaccess.connect();
  await create_tables();
  console.log('Tables created');
}

create_populate().then(() => {
  console.log('Done');
  dbaccess.close();
}).catch((err) => {
  console.error(err);
  dbaccess.close();
}
).finally(() => {
  process.exit(0);
});