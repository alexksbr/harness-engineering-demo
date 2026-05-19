export interface IProfileData {
  username: string;
  bio: string;
  image?: string;
  following?: boolean;
}

export interface IProfileRO {
  profile: IProfileData;
}

export interface ITopProfileData {
  username: string;
  bio: string;
  image?: string;
  followerCount: number;
  email: string;
}

export interface ITopProfilesRO {
  profiles: ITopProfileData[];
}
