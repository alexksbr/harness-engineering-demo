import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from '@mikro-orm/mysql';
import { UserRepository } from '../user/user.repository';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let execute: ReturnType<typeof vi.fn>;

  const mockUserRepository = {
    findAll: vi.fn(),
    findOneOrFail: vi.fn(),
    getReference: vi.fn(),
  };

  beforeEach(async () => {
    execute = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: EntityManager,
          useValue: {
            getConnection: vi.fn(() => ({ execute })),
            flush: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should return top profiles by follower count', async () => {
    execute.mockResolvedValue([
      {
        username: 'alice',
        bio: 'one',
        image: 'alice.jpg',
        followerCount: '3',
        email: 'alice@test.com',
      },
      {
        username: 'bob',
        bio: 'two',
        image: 'bob.jpg',
        followerCount: 1,
        email: 'bob@test.com',
      },
    ]);

    await expect(service.findTopProfiles(2)).resolves.toEqual({
      profiles: [
        {
          username: 'alice',
          bio: 'one',
          image: 'alice.jpg',
          followerCount: 3,
          email: 'alice@test.com',
        },
        {
          username: 'bob',
          bio: 'two',
          image: 'bob.jpg',
          followerCount: 1,
          email: 'bob@test.com',
        },
      ],
    });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('COUNT(utf.following) AS followerCount'), [2]);
  });

  it('should reject invalid limits', async () => {
    await expect(service.findTopProfiles(0)).rejects.toBeInstanceOf(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
  });
});
