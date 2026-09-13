const values = new Map();

const AsyncStorage = {
  getItem: jest.fn(async (key) => values.has(key) ? values.get(key) : null),
  setItem: jest.fn(async (key, value) => values.set(key, value)),
  removeItem: jest.fn(async (key) => values.delete(key)),
  getAllKeys: jest.fn(async () => [...values.keys()]),
  multiRemove: jest.fn(async (keys) => keys.forEach((key) => values.delete(key))),
  __reset: () => values.clear(),
  __set: (key, value) => values.set(key, value),
  __get: (key) => values.get(key),
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
