import { OAuthClient } from "../entities/client.entity";
import { OAuthScope } from "../entities/scope.entity";
import { OAuthToken } from "../entities/token.entity";
import { OAuthUser } from "../entities/user.entity";

export interface OAuthTokenRepository<
  TToken extends OAuthToken = OAuthToken,
  TClient extends OAuthClient = OAuthClient,
  TScope extends OAuthScope = OAuthScope,
  TUser extends OAuthUser = OAuthUser
> {
  issueToken(client: TClient, scopes: TScope[], user?: TUser): Promise<TToken>;

  issueRefreshToken(accessToken: TToken): Promise<TToken>;

  persist(accessToken: TToken): Promise<void>;

  revoke(accessTokenToken: TToken): Promise<void>;

  isRefreshTokenRevoked(refreshToken: TToken): Promise<boolean>;

  getByRefreshToken(refreshTokenToken: string): Promise<TToken>;
}
