import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from '../user/user.entity';
import { IProfileData, IProfileRO, ITopProfilesRO } from './profile.interface';
import { EntityManager, FilterQuery, serialize } from '@mikro-orm/mysql';
import { UserRepository } from '../user/user.repository';

interface TopProfileRow {
  username: string;
  bio: string;
  image: string;
  followerCount: number | string | bigint;
  email: string;
}

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

  async findTopProfiles(limit = 10): Promise<ITopProfilesRO> {
    const normalizedLimit = Math.trunc(limit);

    if (!Number.isFinite(normalizedLimit) || normalizedLimit < 1) {
      throw new BadRequestException('Limit must be a positive integer.');
    }

    const rows = await this.em.getConnection().execute<TopProfileRow[]>(
      `
        SELECT
          u.username,
          u.bio,
          u.image,
          u.email,
          COUNT(utf.following) AS followerCount
        FROM \`user\` u
        LEFT JOIN \`user_to_follower\` utf ON utf.follower = u.id
        GROUP BY u.id, u.username, u.bio, u.image, u.email
        ORDER BY followerCount DESC, u.username ASC
        LIMIT ?
      `,
      [normalizedLimit],
    );

    return {
      profiles: rows.map(row => ({
        username: row.username,
        bio: row.bio,
        image: row.image,
        followerCount: Number(row.followerCount),
        email: row.email,
      })),
    };
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
