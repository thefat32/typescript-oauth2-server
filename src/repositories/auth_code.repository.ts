import { OAuthAuthCode } from "../entities/auth_code.entity";
import { OAuthClient } from "../entities/client.entity";
import { OAuthScope } from "../entities/scope.entity";
import { OAuthUser } from "../entities/user.entity";

export interface OAuthAuthCodeRepository<
  TAuthCode extends OAuthAuthCode = OAuthAuthCode,
  TClient extends OAuthClient = OAuthClient,
  TScope extends OAuthScope = OAuthScope
> {
  getByIdentifier(authCodeCode: string): Promise<TAuthCode>;

  issueAuthCode(client: TClient, user: OAuthUser | undefined, scopes: TScope[]): TAuthCode;

  persist(authCode: TAuthCode): Promise<void>;

  isRevoked(authCodeCode: string): Promise<boolean>;

  revoke(authCodeCode: string): Promise<void>;
}
