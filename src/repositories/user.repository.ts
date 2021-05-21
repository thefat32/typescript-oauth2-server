import { OAuthClient } from "../entities/client.entity";
import { OAuthUser } from "../entities/user.entity";
import { GrantIdentifier } from "../grants/abstract/grant.interface";

export type ExtraAccessTokenFields = Record<string, string | number | boolean>;

export interface OAuthUserRepository<TUser extends OAuthUser = OAuthUser, TClient extends OAuthClient = OAuthClient> {
  getUserByCredentials(
    identifier: string,
    password?: string,
    grantType?: GrantIdentifier,
    client?: TClient,
  ): Promise<TUser | undefined>;

  extraAccessTokenFields?(user: TUser): Promise<ExtraAccessTokenFields | undefined>;
}
