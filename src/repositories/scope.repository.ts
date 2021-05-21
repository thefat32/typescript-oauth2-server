import { OAuthClient } from "../entities/client.entity";
import { OAuthScope } from "../entities/scope.entity";
import { GrantIdentifier } from "../grants/abstract/grant.interface";

export interface OAuthScopeRepository<
  TScope extends OAuthScope = OAuthScope,
  TClient extends OAuthClient = OAuthClient
> {
  getAllByIdentifiers(scopeNames: string[]): Promise<TScope[]>;

  finalize(scopes: TScope[], identifier: GrantIdentifier, client: TClient, user_id?: string): Promise<TScope[]>;
}
