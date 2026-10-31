import {it,expect} from 'vitest';
import {embedPlaceUrl} from '../lib/embed-map';
it('目的地だけをplaceモードへ渡し、出発地・経路再計算のパラメーターを含めない',()=>{const url=new URL(embedPlaceUrl('test-key',{id:'ChIJAbcdefghijk',point:{lat:35,lng:139}}));expect(url.origin).toBe('https://www.google.com');expect(url.pathname).toBe('/maps/embed/v1/place');expect(url.searchParams.get('q')).toBe('place_id:ChIJAbcdefghijk');expect(url.searchParams.has('origin')).toBe(false);expect(url.searchParams.has('destination')).toBe(false);expect(url.searchParams.get('language')).toBe('ja');});
it('Place IDがない場合は緯度経度を渡す',()=>{const url=new URL(embedPlaceUrl('test-key',{id:'',point:{lat:35.6,lng:139.7}}));expect(url.searchParams.get('q')).toBe('35.6,139.7');});
