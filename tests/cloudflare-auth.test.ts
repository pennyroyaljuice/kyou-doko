import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { sanitizedHeaders, validateAccessToken } from '../lib/cloudflare-auth';
const env={CF_ACCESS_TEAM_DOMAIN:'https://test-team.cloudflareaccess.com',CF_ACCESS_AUD:'app-audience',LIVE_SEARCH_OWNER_EMAIL:'owner@example.test'};
let privateKey:CryptoKey;let keys:ReturnType<typeof createLocalJWKSet>;
beforeAll(async()=>{const pair=await generateKeyPair('RS256');privateKey=pair.privateKey;keys=createLocalJWKSet({keys:[{...await exportJWK(pair.publicKey),kid:'test',alg:'RS256'}]});});
const token=(changes:{issuer?:string;audience?:string;email?:string;expiration?:number}={})=>new SignJWT({email:changes.email??env.LIVE_SEARCH_OWNER_EMAIL}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('owner-id').setIssuer(changes.issuer??env.CF_ACCESS_TEAM_DOMAIN).setAudience(changes.audience??env.CF_ACCESS_AUD).setExpirationTime(changes.expiration??Math.floor(Date.now()/1000)+300).sign(privateKey);
describe('Cloudflare本人認証',()=>{
 it('正しい署名・発行元・対象・本人のみ許可',async()=>{expect(await validateAccessToken(await token(),env,keys)).toEqual({id:'owner-id',email:'owner@example.test'});});
 it.each([{issuer:'https://other.cloudflareaccess.com'},{audience:'other-app'},{email:'other@example.test'},{expiration:1}])('異なる認証情報を拒否 %j',async value=>{expect(await validateAccessToken(await token(value),env,keys)).toBeNull();});
 it('未設定・未認証・偽造トークンを拒否',async()=>{expect(await validateAccessToken(undefined,env,keys)).toBeNull();expect(await validateAccessToken('forged',env,keys)).toBeNull();expect(await validateAccessToken(await token(),{},keys)).toBeNull();});
 it('外部から渡された本人ヘッダーを削除',()=>{const cleaned=sanitizedHeaders(new Request('https://example.test',{headers:{'oai-authenticated-user-id':'fake','oai-authenticated-user-email':'owner@example.test','x-kyou-user-id':'fake','Content-Type':'application/json'}}));expect(cleaned.has('oai-authenticated-user-id')).toBe(false);expect(cleaned.has('oai-authenticated-user-email')).toBe(false);expect(cleaned.has('x-kyou-user-id')).toBe(false);expect(cleaned.get('content-type')).toBe('application/json');});
});
