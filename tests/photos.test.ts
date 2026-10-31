import {afterEach,describe,it,expect,vi} from 'vitest';
import {photoTicket,servePhoto} from '../lib/photos';
import {GoogleProvider} from '../lib/google';
const secret='s'.repeat(48),name='places/ChIJtest/photos/TestPhoto';
const env={ADMIN_SESSION_SECRET:secret,GOOGLE_MAPS_API_KEY:secret,LIVE_SEARCH_ENABLED:'true',PHOTO_LIMITER:{limit:async()=>({success:true})}};
const request=async()=>new Request('https://example.test/admin/api/photo?ticket='+await photoTicket(name,secret));
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('候補写真',()=>{
 it('不正な写真名を署名しない',async()=>{expect(await photoTicket('https://evil.test',secret)).toBeUndefined();expect(await photoTicket('places/x/photos/../../secret',secret)).toBeUndefined();});
 it('偽造・停止中は上流を呼ばない',async()=>{const upstream=vi.fn();expect((await servePhoto(new Request('https://example.test/?ticket=forged'),env,upstream)).status).toBe(403);expect((await servePhoto(await request(),{...env,LIVE_SEARCH_ENABLED:'false'},upstream)).status).toBe(503);expect(upstream).not.toHaveBeenCalled();});
 it('小さな画像1枚をno-storeで返し秘密キーを転送しない',async()=>{const upstream=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({photoUri:'https://lh3.googleusercontent.com/photo'}))).mockResolvedValueOnce(new Response('image',{headers:{'Content-Type':'image/jpeg'}}));const response=await servePhoto(await request(),env,upstream);expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(new URL(upstream.mock.calls[0][0]).searchParams.get('maxWidthPx')).toBe('240');expect(upstream.mock.calls[1][1].headers).toBeUndefined();expect(upstream.mock.calls[0][1].redirect).toBe('manual');expect(upstream.mock.calls[1][1].redirect).toBe('manual');expect(upstream).toHaveBeenCalledTimes(2);});
 it('任意URLや非画像を返さない',async()=>{const upstream=vi.fn().mockResolvedValue(new Response(JSON.stringify({photoUri:'https://evil.test/photo'})));expect((await servePhoto(await request(),env,upstream)).status).toBe(502);expect(upstream).toHaveBeenCalledTimes(1);});
 it('取得制限では上流を呼ばない',async()=>{const upstream=vi.fn();expect((await servePhoto(await request(),{...env,PHOTO_LIMITER:{limit:async()=>({success:false})}},upstream)).status).toBe(429);expect(upstream).not.toHaveBeenCalled();});
 it('追加Detailsなしで検索レスポンスから写真と著者を得る',async()=>{vi.stubEnv('ADMIN_SESSION_SECRET',secret);const upstream=vi.fn().mockResolvedValue(new Response(JSON.stringify({places:[{id:'test',location:{latitude:35,longitude:139},photos:[{name,authorAttributions:[{displayName:'撮影者',uri:'https://maps.google.com/test'}]}]}]})));vi.stubGlobal('fetch',upstream);const places=await new GoogleProvider(secret).nearby({lat:35,lng:139},1000);expect(places[0].photo?.authors[0].name).toBe('撮影者');expect(places[0].photo?.ticket).toBeTruthy();expect(upstream).toHaveBeenCalledTimes(1);});
});
