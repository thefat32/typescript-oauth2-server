import { DateInterval } from "@jmondi/date-interval";

import { OAuthAccessToken } from "~/entities/access_token.entity";
import { OAuthAuthCode } from "~/entities/auth_code.entity";
import { OAuthClient } from "~/entities/client.entity";
import { OAuthRefreshToken } from "~/entities/refresh_token.entity";
import { OAuthScope } from "~/entities/scope.entity";
import { OAuthException } from "~/exceptions/oauth.exception";
import { GrantIdentifier, GrantInterface } from "~/grants/grant.interface";
import { OAuthAccessTokenRepository } from "~/repositories/access_token.repository";
import { OAuthAuthCodeRepository } from "~/repositories/auth_code.repository";
import { OAuthClientRepository } from "~/repositories/client.repository";
import { OAuthRefreshTokenRepository } from "~/repositories/refresh_token.repository";
import { OAuthScopeRepository } from "~/repositories/scope.repository";
import { OAuthUserRepository } from "~/repositories/user.repository";
import { AuthorizationRequest } from "~/requests/authorization.request";
import { RequestInterface } from "~/requests/request";
import { BearerTokenResponse } from "~/responses/bearer_token.response";
import { ResponseInterface } from "~/responses/response";
import { arrayDiff } from "~/utils/array";
import { base64decode } from "~/utils/base64";
import { JwtService } from "~/utils/jwt";

export abstract class AbstractGrant implements GrantInterface {
  protected readonly scopeDelimiterString = " ";

  protected readonly supportedGrantTypes: GrantIdentifier[] = ["client_credentials", "authorization_code"];

  abstract readonly identifier: GrantIdentifier;

  constructor(
    protected readonly clientRepository: OAuthClientRepository,
    protected readonly accessTokenRepository: OAuthAccessTokenRepository,
    protected readonly refreshTokenRepository: OAuthRefreshTokenRepository,
    protected readonly authCodeRepository: OAuthAuthCodeRepository,
    protected readonly scopeRepository: OAuthScopeRepository,
    protected readonly userRepository: OAuthUserRepository,
    protected readonly jwt: JwtService,
  ) {}

  protected async makeBearerTokenResponse(
    client: OAuthClient,
    accessToken: OAuthAccessToken,
    refreshToken?: OAuthRefreshToken,
    userId?: string | undefined,
    scopes: OAuthScope[] = [],
  ) {
    const scope = scopes.map((scope) => scope.name).join(this.scopeDelimiterString);

    const bearerTokenResponse = new BearerTokenResponse(accessToken);

    const expiresAtMs = accessToken.expiresAt.getTime();
    const expiresIn = Math.ceil((expiresAtMs - Date.now()) / 1000);

    const encryptedAccessToken = await this.encrypt({
      iss: undefined, // @see https://tools.ietf.org/html/rfc7519#section-4.1.1
      sub: userId, // @see https://tools.ietf.org/html/rfc7519#section-4.1.2
      aud: undefined, // @see https://tools.ietf.org/html/rfc7519#section-4.1.3
      exp: Math.ceil(expiresAtMs / 1000), // @see https://tools.ietf.org/html/rfc7519#section-4.1.4
      nbf: Math.ceil(Date.now() / 1000), // @see https://tools.ietf.org/html/rfc7519#section-4.1.5
      iat: Math.ceil(Date.now() / 1000), // @see https://tools.ietf.org/html/rfc7519#section-4.1.6
      jti: accessToken.token, // @see https://tools.ietf.org/html/rfc7519#section-4.1.7

      // non standard claims
      cid: client.name,
      scope,
    });

    let encryptedRefreshToken: string | undefined = undefined;

    if (refreshToken) {
      encryptedRefreshToken = await this.encrypt({
        client_id: client.id,
        access_token_id: accessToken.token,
        refresh_token_id: refreshToken.refreshToken,
        scope,
        user_id: userId,
        expire_time: Math.ceil(expiresAtMs / 1000),
      });
    }

    bearerTokenResponse.body = {
      token_type: "Bearer",
      expires_in: expiresIn,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      scope,
    };

    return bearerTokenResponse;
  }

  protected async validateClient(request: RequestInterface): Promise<OAuthClient> {
    const [clientId, clientSecret] = this.getClientCredentials(request);

    const grantType = this.getGrantType(request);

    const client = await this.clientRepository.getClientByIdentifier(clientId);

    const userValidationSuccess = await this.clientRepository.isClientValid(grantType, client, clientSecret);

    if (!userValidationSuccess) {
      throw OAuthException.invalidClient();
    }

    if (grantType === "client_credentials") {
      if (!client.secret || !clientSecret || client.secret !== clientSecret) {
        console.log({ grantType, clientSecret });
        throw OAuthException.invalidClient();
      }
    }

    return client;
  }

  protected getClientCredentials(request: RequestInterface): [string, string | undefined] {
    const [basicAuthUser, basicAuthPass] = this.getBasicAuthCredentials(request);

    let clientId = this.getRequestParameter("client_id", request, basicAuthUser);

    if (!clientId) {
      console.log({ clientId });
      throw OAuthException.invalidRequest("client_id");
    }

    let clientSecret = this.getRequestParameter("client_secret", request, basicAuthPass);

    if (Array.isArray(clientId) && clientId.length > 0) clientId = clientId[0];

    if (Array.isArray(clientSecret) && clientSecret.length > 0) clientSecret = clientSecret[0];

    return [clientId, clientSecret];
  }

  protected getBasicAuthCredentials(request: RequestInterface) {
    if (!request.headers?.hasOwnProperty("authorization")) {
      return [undefined, undefined];
    }

    const header = request.headers["authorization"];

    if (!header || !header.startsWith("Basic ")) {
      return [undefined, undefined];
    }

    const decoded = base64decode(header.substr(6, header.length));

    if (!decoded.includes(":")) {
      return [undefined, undefined];
    }

    return decoded.split(":");
  }

  protected validateRedirectUri(redirectUri: string, client: OAuthClient) {
    if (redirectUri === "" || !client.redirectUris.includes(redirectUri)) {
      throw OAuthException.invalidClient();
    }
  }

  protected async validateScopes(scopes: string | string[], redirectUri?: string): Promise<OAuthScope[]> {
    if (typeof scopes === "string") {
      scopes = scopes.split(this.scopeDelimiterString);
    }

    const validScopes = await this.scopeRepository.getScopesByIdentifier(scopes);

    const invalidScopes = arrayDiff(
      scopes,
      validScopes.map((scope) => scope.name),
    );

    if (invalidScopes.length > 0) {
      throw OAuthException.invalidScope(invalidScopes.join(", "), redirectUri);
    }

    return validScopes;
  }

  protected async issueAccessToken(
    accessTokenTTL: DateInterval,
    client: OAuthClient,
    userId?: string,
    scopes: OAuthScope[] = [],
  ): Promise<OAuthAccessToken> {
    const accessToken = await this.accessTokenRepository.getNewToken(client, scopes, userId);

    accessToken.expiresAt = accessTokenTTL.end();

    await this.accessTokenRepository.persistNewAccessToken(accessToken);

    return accessToken;
  }

  protected async issueAuthCode(
    authCodeTTL: DateInterval,
    client: OAuthClient,
    userIdentifier?: string,
    redirectUri?: string,
    codeChallenge?: string,
    codeChallengeMethod?: string,
    scopes: OAuthScope[] = [],
  ): Promise<OAuthAuthCode> {
    const user = userIdentifier ? await this.userRepository.getByUserIdentifier(userIdentifier) : undefined;

    const authCode = await this.authCodeRepository.getNewAuthCode(client, user, scopes);
    authCode.expiresAt = authCodeTTL.end();
    authCode.redirectUri = redirectUri;
    authCode.codeChallenge = codeChallenge;
    authCode.codeChallengeMethod = codeChallengeMethod;
    scopes.forEach((scope) => (authCode.scopes ? authCode.scopes.push(scope) : (authCode.scopes = [scope])));
    await this.authCodeRepository.persistNewAuthCode(authCode);
    return authCode;
  }

  protected async issueRefreshToken(accessToken: OAuthAccessToken): Promise<OAuthRefreshToken | undefined> {
    const refreshToken = await this.refreshTokenRepository.getNewToken(accessToken);

    if (!refreshToken) {
      return;
    }

    await this.refreshTokenRepository.persistNewRefreshToken(refreshToken);

    return refreshToken;
  }

  protected getGrantType(request: RequestInterface): GrantIdentifier {
    const result =
      this.getRequestParameter("grant_type", request) ?? this.getQueryStringParameter("grant_type", request);

    if (!result || !this.supportedGrantTypes.includes(result)) {
      throw OAuthException.invalidRequest("grant_type");
    }

    if (this.identifier !== result) {
      throw OAuthException.invalidRequest("grant_type", "something went wrong"); // @todo remove the something went wrong
    }

    return result;
  }

  protected getRequestParameter(param: string, request: RequestInterface, defaultValue?: any) {
    return request.body?.[param] ?? defaultValue;
  }

  protected getQueryStringParameter(param: string, request: RequestInterface, defaultValue?: any) {
    return request.query?.[param] ?? defaultValue;
  }

  protected encrypt(unencryptedData: string | Buffer | object): Promise<string> {
    return this.jwt.sign(unencryptedData);
  }

  protected async decrypt(encryptedData: string) {
    return await this.jwt.verify(encryptedData);
  }

  validateAuthorizationRequest(request: RequestInterface): Promise<AuthorizationRequest> {
    throw new Error("Grant does not support the request");
  }

  canRespondToAccessTokenRequest(request: RequestInterface): boolean {
    return this.getRequestParameter("grant_type", request) === this.identifier;
  }

  canRespondToAuthorizationRequest(request: RequestInterface): boolean {
    return false;
  }

  async completeAuthorizationRequest(authorizationRequest: AuthorizationRequest): Promise<ResponseInterface> {
    throw new Error("Grant does not support the request");
  }

  async respondToAccessTokenRequest(
    request: RequestInterface,
    response: ResponseInterface,
    accessTokenTTL: DateInterval,
  ): Promise<ResponseInterface> {
    throw new Error("Grant does not support the request");
  }
}
