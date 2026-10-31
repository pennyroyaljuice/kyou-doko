import { describe, expect, it, vi } from 'vitest';
import { getCurrentLocation } from '../lib/location';
import { googleConfig } from '../lib/runtime-config';
describe('現在地', () => {
  it('クリックに応じた一回取得で座標と精度を返す', async () => {
    const getCurrentPosition = vi.fn((ok:PositionCallback) => ok({coords:{latitude:35,longitude:139,accuracy:25}} as GeolocationPosition));
    expect(await getCurrentLocation({getCurrentPosition},true)).toEqual({point:{lat:35,lng:139},accuracy:25});
    expect(getCurrentPosition.mock.calls[0]).toHaveLength(3);
    expect((getCurrentPosition.mock.calls as unknown[][])[0][2]).toEqual({timeout:15000,maximumAge:0,enableHighAccuracy:true});
  });
  it.each([[1,'許可'],[2,'電波'],[3,'タイムアウト']])('取得失敗%sでも手入力を案内',async(code,word)=>{
    const geo={getCurrentPosition:(_ok:PositionCallback,error?:PositionErrorCallback|null)=>error?.({code} as GeolocationPositionError)};
    await expect(getCurrentLocation(geo,true)).rejects.toThrow(word);
    await expect(getCurrentLocation(geo,true)).rejects.toThrow('手入力');
  });
  it('HTTPS以外では位置情報を呼ばない',async()=>{
    const geo={getCurrentPosition:vi.fn()}; await expect(getCurrentLocation(geo,false)).rejects.toThrow('HTTPS'); expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });
  it('非対応ブラウザーでは手入力を案内',async()=>{await expect(getCurrentLocation(undefined,true)).rejects.toThrow('手入力');});
});
describe('公開キーのランタイム読み取り',()=>{
  it('環境設定の変更を次の読み取りへ反映する',()=>{
    const server=process.env.GOOGLE_MAPS_API_KEY, browser=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    try {
      process.env.GOOGLE_MAPS_API_KEY='test-server';process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY='test-browser';
      expect(googleConfig()).toEqual({serverKey:'test-server',browserKey:'test-browser'});
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY='updated-browser';expect(googleConfig().browserKey).toBe('updated-browser');
    } finally {
      if(server===undefined)delete process.env.GOOGLE_MAPS_API_KEY;else process.env.GOOGLE_MAPS_API_KEY=server;
      if(browser===undefined)delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=browser;
    }
  });
});
