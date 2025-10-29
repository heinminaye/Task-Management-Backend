import type Redis from 'ioredis';

type RedisMockType = jest.Mocked<Partial<Redis>>;

const createMockRedis = (): RedisMockType => {
  const mock: RedisMockType = {
    on: jest.fn(),
    connect: jest.fn(),
    quit: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    psubscribe: jest.fn(),
    subscribe: jest.fn(),
    publish: jest.fn(),
    duplicate: jest.fn().mockImplementation(() => createMockRedis()),
  };
  return mock;
};

const MockRedis = jest.fn().mockImplementation(createMockRedis);

// Mock ioredis module
jest.mock('ioredis', () => ({
  __esModule: true,
  default: MockRedis,
  Redis: MockRedis,
}));

console.log('🧪 Redis has been fully mocked for e2e tests (with pub/sub)');
