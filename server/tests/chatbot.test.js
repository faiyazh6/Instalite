import { jest } from '@jest/globals';
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

jest.unstable_mockModule('../../installite-backend/utils/vector.js', () => ({
  retrieveRelevantDocs: jest.fn(),
  createRetrieverFromDatabase: jest.fn()
}));

jest.unstable_mockModule('@langchain/openai', () => {
  const mockCall = jest.fn().mockResolvedValue({
    text: 'George Albert Smith and Georges Méliès directed Cinderella.'
  });
  return {
    ChatOpenAI: jest.fn(() => ({
      call: mockCall
    }))
  };
});

let callChatbot;
let retrieveRelevantDocs;
let ChatOpenAI;

beforeEach(async () => {
  jest.clearAllMocks();

  // Dynamically import after mocks are applied (need both OpenAI, vector.js, and the mock call to be running first)
  const chatbotModule = await import('../../chatbot/chatbot.js');
  callChatbot = chatbotModule.callChatbot;

  const vectorModule = await import('../../installite-backend/utils/vector.js');
  retrieveRelevantDocs = vectorModule.retrieveRelevantDocs;

  const openaiModule = await import('@langchain/openai');
  ChatOpenAI = openaiModule.ChatOpenAI;
});

describe('callChatbot()', () => {
  test('returns an answer string from the model', async () => {
    retrieveRelevantDocs.mockResolvedValue([
      { pageContent: 'George Albert Smith and Georges Méliès directed Cinderella.' }
    ]);

    const result = await callChatbot('Who directed Cinderella?');

    expect(typeof result).toBe('string');
    expect(result).toBe('George Albert Smith and Georges Méliès directed Cinderella.');

    const instance = ChatOpenAI.mock.results[0].value;
    expect(instance.call).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Who directed Cinderella?')
        })
      ])
    );
  });

  test('returns an error message if something fails', async () => {
    retrieveRelevantDocs.mockRejectedValue(new Error('Vector error'));

    const result = await callChatbot('Who starred in The Notebook?');
    expect(result).toBe('Sorry, I had an issue answering your question.');
  });
});
