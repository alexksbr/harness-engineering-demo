import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from '../user/user.entity';
import { IProfileData, IProfileRO, ITopProfileData, ITopProfilesRO } from './profile.interface';
import { EntityManager, FilterQuery, QueryOrder, raw, serialize } from '@mikro-orm/mysql';
import { UserRepository } from '../user/user.repository';

const TOP_PROFILES_LIMIT_MAX = 100;

type TopProfileRow = {
  username: string;
  bio: string;
  image?: string;
  followersCount: number | string;
};

@Injectable()
export class ProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly em: EntityManager,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async findOne(where: FilterQuery<User>): Promise<IProfileRO> {
    const user = await this.userRepository.findOneOrFail(where);
    return { profile: serialize(user, { exclude: ['id', 'password'] }) };
  }

  async findTop(limit: number): Promise<ITopProfilesRO> {
    const rows = await this.userRepository
      .createQueryBuilder('u')
      .select(['u.username', 'u.bio', 'u.image', raw('count(f.id) as followersCount')])
      .leftJoin('u.followers', 'f')
      .groupBy(['u.id', 'u.username', 'u.bio', 'u.image'])
      .orderBy({ followersCount: QueryOrder.DESC, username: QueryOrder.ASC })
      .limit(Math.min(Math.max(limit, 1), TOP_PROFILES_LIMIT_MAX))
      .execute<TopProfileRow[]>();

    const profiles: ITopProfileData[] = rows.map(row => ({
      bio: row.bio,
      followersCount: Number(row.followersCount),
      image: row.image,
      username: row.username,
    }));

    return { profiles, profilesCount: profiles.length };
  }

  async findProfile(id: number, followingUsername: string): Promise<IProfileRO> {
    const foundProfile = await this.userRepository.findOneOrFail(
      { username: followingUsername },
      {
        populate: ['followers'],
      },
    );
    const follower = this.userRepository.getReference(id);

    const profile: IProfileData = {
      bio: foundProfile.bio,
      image: foundProfile.image,
      username: foundProfile.username,
      following: foundProfile.followers.contains(follower),
    };

    return { profile };
  }

  async follow(followerEmail: string, username: string): Promise<IProfileRO> {
    if (!followerEmail || !username) {
      throw new HttpException('Follower email and username not provided.', HttpStatus.BAD_REQUEST);
    }

    const followingUser = await this.userRepository.findOneOrFail(
      { username },
      {
        populate: ['followers'],
      },
    );
    const followerUser = await this.userRepository.findOneOrFail({ email: followerEmail });

    if (followingUser.email === followerEmail) {
      throw new HttpException('FollowerEmail and FollowingId cannot be equal.', HttpStatus.BAD_REQUEST);
    }

    followingUser.followers.add(followerUser);
    await this.em.flush();

    const profile: IProfileData = {
      bio: followingUser.bio,
      following: true,
      image: followingUser.image,
      username: followingUser.username,
    };

    return { profile };
  }

  async unFollow(followerId: number, username: string): Promise<IProfileRO> {
    if (!followerId || !username) {
      throw new HttpException('FollowerId and username not provided.', HttpStatus.BAD_REQUEST);
    }

    const followingUser = await this.userRepository.findOneOrFail(
      { username },
      {
        populate: ['followers'],
      },
    );
    const followerUser = this.userRepository.getReference(followerId);

    if (followingUser.id === followerId) {
      throw new HttpException('FollowerId and FollowingId cannot be equal.', HttpStatus.BAD_REQUEST);
    }

    followingUser.followers.remove(followerUser);
    await this.em.flush();

    const profile: IProfileData = {
      bio: followingUser.bio,
      following: false,
      image: followingUser.image,
      username: followingUser.username,
    };

    return { profile };
  }
}
