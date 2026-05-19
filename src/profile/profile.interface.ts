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
  followersCount: number;
}

export interface ITopProfilesRO {
  profiles: ITopProfileData[];
  profilesCount: number;
}
