import { Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '../user/user.decorator';
import { IProfileRO, ITopProfilesRO } from './profile.interface';
import { ProfileService } from './profile.service';

@ApiBearerAuth()
@ApiTags('profiles')
@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('top')
  async getTopProfiles(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number): Promise<ITopProfilesRO> {
    return this.profileService.findTopProfiles(limit);
  }

  @Get(':username')
  async getProfile(@User('id') userId: number, @Param('username') username: string): Promise<IProfileRO> {
    return this.profileService.findProfile(userId, username);
  }

  @Post(':username/follow')
  @HttpCode(200)
  async follow(@User('email') email: string, @Param('username') username: string): Promise<IProfileRO> {
    return this.profileService.follow(email, username);
  }

  @Delete(':username/follow')
  async unFollow(@User('id') userId: number, @Param('username') username: string): Promise<IProfileRO> {
    return this.profileService.unFollow(userId, username);
  }
}
