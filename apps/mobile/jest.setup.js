// Runs before each test file (see "jest" in package.json).
// The API client reads its base URL when it's first imported.
process.env.EXPO_PUBLIC_API_URL = 'http://api.test/api/v1';
