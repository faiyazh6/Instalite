const { expect } = require('chai');

// Simulated Kafka functions (replace with real imports as needed)
const {
  producePostEvent,
  produceLikeEvent,
  produceCommentEvent,
  consumePostEvent,
  consumeLikeEvent,
  consumeCommentEvent
} = require('../server/kafka_utils'); // Adjust the path based on your project structure

describe('Kafka Streaming Module', function () {

  describe('producePostEvent(postData)', function () {
    it('should return { success: true } for valid post data', async function () {
      const postData = {
        username: 'shreya',
        source_site: 'g01',
        post_uuid_within_site: 'post123',
        post_text: 'hello from kafka!',
        content_type: 'text/plain',
        attach: null
      };

      const result = await producePostEvent(postData);
      expect(result).to.be.an('object');
      expect(result).to.have.property('success', true);
    });
  });

  describe('produceLikeEvent(likeData)', function () {
    it('should return { success: true } for valid like data', async function () {
      const likeData = {
        username: 'shreya',
        post_uuid_within_site: 'post456'
      };

      const result = await produceLikeEvent(likeData);
      expect(result).to.be.an('object');
      expect(result).to.have.property('success', true);
    });
  });

  describe('produceCommentEvent(commentData)', function () {
    it('should return { success: true } for valid comment data', async function () {
      const commentData = {
        username: 'shreya',
        commentId: 'comment321',
        post_uuid_within_site: 'post111',
        text: 'Nice post!'
      };

      const result = await produceCommentEvent(commentData);
      expect(result).to.be.an('object');
      expect(result).to.have.property('success', true);
    });
  });

  describe('consumePostEvent(message)', function () {
    it('should return { success: true } for valid post message', async function () {
      const message = {
        value: Buffer.from(JSON.stringify({
          username: 'shreya',
          source_site: 'g01',
          post_uuid_within_site: 'post789',
          post_text: 'Kafka testing!',
          content_type: 'text/plain',
          attach: null
        }))
      };

      const result = await consumePostEvent(message);
      expect(result).to.have.property('success', true);
    });
  });

  describe('consumeLikeEvent(message)', function () {
    it('should return { success: true } for valid like message', async function () {
      const message = {
        value: Buffer.from(JSON.stringify({
          username: 'shreya',
          post_uuid_within_site: 'post987'
        }))
      };

      const result = await consumeLikeEvent(message);
      expect(result).to.have.property('success', true);
    });
  });

  describe('consumeCommentEvent(message)', function () {
    it('should return { success: true } for valid comment message', async function () {
      const message = {
        value: Buffer.from(JSON.stringify({
          username: 'shreya',
          commentId: 'comment999',
          post_uuid_within_site: 'post222',
          text: 'Great post'
        }))
      };

      const result = await consumeCommentEvent(message);
      expect(result).to.have.property('success', true);
    });
  });

});
