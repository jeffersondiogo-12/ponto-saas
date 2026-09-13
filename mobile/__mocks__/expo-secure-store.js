const values = new Map();

module.exports = {
  getItemAsync: jest.fn(async (key) => values.has(key) ? values.get(key) : null),
  setItemAsync: jest.fn(async (key, value) => values.set(key, value)),
  deleteItemAsync: jest.fn(async (key) => values.delete(key)),
  __reset: () => values.clear(),
  __get: (key) => values.get(key),
};
