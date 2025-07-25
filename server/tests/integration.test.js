// ===============================================
// EXPECTED FLOW - Full System Integration Test
// ===============================================
//
// This file runs a full end-to-end simulation of a typical user experience.
// Each step should call into previously tested components and assert that data flows correctly.
//
// Sequence of expected steps:
//
// 1. registerUser(userInfo)
//    - Registers a new user in the system
//
// 2. uploadProfileImage(userId, imageBuffer)
//    - Uploads profile photo to S3 and stores URL
//
// 3. generateEmbedding(imageBuffer)
//    - Generates a vector embedding for the user photo
//
// 4. getTopActorMatches(embedding)
//    - Queries ChromaDB and returns top-5 actors
//
// 5. linkActorToUser(userId, actorId)
//    - Stores actor link and posts status update
//
// 6. authenticateUser(login, password)
//    - Logs the user in and returns a token
//
// 7. createPost(userId, content, image)
//    - Creates a post with optional text/image and hashtags
//
// 8. addComment(postId, userId, text)
//    - Adds a comment to a post
//
// 9. likePost(postId, userId)
//    - Likes a post
//
// 10. createChat([userId1, userId2])
//     - Starts a chat session
//
// 11. sendMessage(chatId, userId, message)
//     - Sends a message to the chat
//
// 12. logoutUser(token) [optional]
//     - Invalidates session or marks user offline
//
// ===============================================
