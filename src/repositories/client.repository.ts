import { OAuthClient } from "../entities/client.entity";
import { GrantIdentifier } from "../grants/abstract/grant.interface";

export interface OAuthClientRepository<TClient extends OAuthClient = OAuthClient> {
  getByIdentifier(clientId: string): Promise<TClient>;

  isClientValid(grantType: GrantIdentifier, client: TClient, clientSecret?: string): Promise<boolean>;
}
