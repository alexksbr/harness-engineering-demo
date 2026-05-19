import { EntityManager } from '@mikro-orm/mysql';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository } from '../user/user.repository';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let queryBuilder: {
    execute: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    leftJoin: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  };

  const mockEntityManager = {
    flush: vi.fn().mockResolvedValue(undefined),
  };

  const mockUserRepository = {
    createQueryBuilder: vi.fn(),
  };

  beforeEach(async () => {
    queryBuilder = {
      execute: vi.fn().mockResolvedValue([
        {
          bio: 'Author bio',
          email: 'private@example.com',
          followersCount: '3',
          image: 'avatar.png',
          username: 'author',
        },
      ]),
      groupBy: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };
    mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns top profiles without listing email addresses', async () => {
    const result = await service.findTop(10);

    expect(mockUserRepository.createQueryBuilder).toHaveBeenCalledWith('u');
    expect(queryBuilder.leftJoin).toHaveBeenCalledWith('u.followers', 'f');
    expect(queryBuilder.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      profiles: [
        {
          bio: 'Author bio',
          followersCount: 3,
          image: 'avatar.png',
          username: 'author',
        },
      ],
      profilesCount: 1,
    });
    expect(result.profiles[0]).not.toHaveProperty('email');
  });
});
