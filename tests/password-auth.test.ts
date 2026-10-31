import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { passwordHash,passwordMatches,sessionCookie,authenticated,sameOrigin,expiredCookie } from '../lib/password-auth';
const origin='https://example.test';
async function environment(){return {ADMIN_PASSWORD_HASH:await passwordHash('a-very-long-random-test-password'),ADMIN_SESSION_SECRET:'s'.repeat(48),LIVE_SEARCH_OWNER_EMAIL:'owner@example.test'};}
const request=(cookie:string)=>new Request(origin+'/admin/',{headers:{Cookie:cookie}});
describe('管理者パスワード認証',()=>{
 it('正しいパスワードのみ受け付け、未設定は拒否',async()=>{const env=await environment();expect(await passwordMatches('a-very-long-random-test-password',env)).toBe(true);expect(await passwordMatches('wrong',env)).toBe(false);expect(await passwordMatches('a-very-long-random-test-password',{})).toBe(false);});
 it('安全なCookieで本人を認証し、偽造と他のサイトのCookieを拒否',async()=>{const env=await environment(),cookie=await sessionCookie(env,origin);expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict');expect(await authenticated(request(cookie),env)).toBe(true);expect(await authenticated(request(cookie.replace(/eyJ/,'xxx')),env)).toBe(false);expect(await authenticated(new Request('https://other.test/admin/',{headers:{Cookie:cookie}}),env)).toBe(false);});
 it('期限切れ、パスワード変更、秘密鍵変更、Cookieなしを拒否',async()=>{const env=await environment(),cookie=await sessionCookie(env,origin);expect(await authenticated(request(cookie),{...env,ADMIN_PASSWORD_HASH:await passwordHash('new-password')})).toBe(false);expect(await authenticated(request(cookie),{...env,ADMIN_SESSION_SECRET:'x'.repeat(48)})).toBe(false);expect(await authenticated(request(''),env)).toBe(false);const expired=await new SignJWT({version:env.ADMIN_PASSWORD_HASH}).setProtectedHeader({alg:'HS256'}).setSubject('password-owner').setIssuer(origin).setAudience('kyou-admin').setIssuedAt().setExpirationTime(1).sign(new TextEncoder().encode(env.ADMIN_SESSION_SECRET));expect(await authenticated(request('__Host-kyou-admin='+expired),env)).toBe(false);expect(expiredCookie).toContain('Max-Age=0');});
 it('他サイトからの送信とOriginなしを拒否',()=>{expect(sameOrigin(new Request(origin,{headers:{Origin:origin}}))).toBe(true);expect(sameOrigin(new Request(origin,{headers:{Origin:'https://evil.test'}}))).toBe(false);expect(sameOrigin(new Request(origin))).toBe(false);});
});
