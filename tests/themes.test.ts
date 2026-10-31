import {afterEach,describe,it,expect,vi} from 'vitest';
import {parseInput,type SearchInput} from '../lib/domain';
import {GoogleProvider} from '../lib/google';
import {demoSearch} from '../lib/demo';
import {search} from '../lib/search';
import {matchesTheme} from '../lib/themes';
const input:SearchInput={source:'google',origin:'東京駅',mode:'DRIVE',metric:'time',budget:120,roundTrip:true};
afterEach(()=>vi.unstubAllGlobals());
describe('目的地の種類',()=>{
 it('既存入力はすべて、不正な種類は拒否',()=>{expect(parseInput(input).theme).toBe('all');expect(()=>parseInput({...input,theme:'unknown'})).toThrow();});
 it('自然では公園にも分類された遊園地を除外する',()=>{expect(matchesTheme(['park','amusement_park','tourist_attraction'],'nature')).toBe(false);expect(matchesTheme(['mountain_peak','tourist_attraction'],'nature','mountain_peak')).toBe(true);expect(matchesTheme(undefined,'nature')).toBe(false);expect(matchesTheme(['park','castle'],'nature','castle')).toBe(false);expect(matchesTheme(['observation_deck','tourist_attraction'],'nature','observation_deck')).toBe(false);});
 it('1回のNearby Searchで分類し、対象外の候補を経路計算前に除外する',async()=>{
 const f=vi.fn().mockResolvedValue(new Response(JSON.stringify({places:[{id:'mountain',primaryType:'mountain_peak',types:['mountain_peak'],location:{latitude:35,longitude:139}},{id:'disney',primaryType:'amusement_park',types:['park','amusement_park'],location:{latitude:35,longitude:139}}]})));vi.stubGlobal('fetch',f);
 const places=await new GoogleProvider('test').nearby({lat:35,lng:139},1000,'nature');expect(places.map(p=>p.id)).toEqual(['mountain']);expect(f).toHaveBeenCalledTimes(1);const body=JSON.parse(f.mock.calls[0][1].body);expect(body.includedPrimaryTypes).toContain('mountain_peak');expect(body.excludedTypes).toContain('amusement_park');expect(f.mock.calls[0][1].headers['X-Goog-FieldMask']).toContain('places.types');
 });
 it('種類を候補検索へ引き継ぎ、0件時に別の種類で再検索しない',async()=>{const nearby=vi.fn().mockResolvedValue([]),route=vi.fn();const r=await search({...input,theme:'nature'},{resolve:async()=>({point:{lat:35,lng:139},label:'東京駅'}),nearby,route});expect(nearby).toHaveBeenCalledWith({lat:35,lng:139},50000,'nature');expect(nearby).toHaveBeenCalledTimes(1);expect(route).not.toHaveBeenCalled();expect(r.destinations).toEqual([]);expect(r.notices.join('')).toContain('峠');});
 it('デモでも自然とテーマパークを区別する',()=>{const nature=demoSearch({...input,source:'demo',theme:'nature'}),tourism=demoSearch({...input,source:'demo',theme:'tourism'});expect(nature.destinations.length).toBeGreaterThan(0);expect(nature.destinations.some(p=>p.id==='disney')).toBe(false);expect(tourism.destinations.some(p=>p.id==='disney')).toBe(true);expect(tourism.destinations.some(p=>p.id==='todoroki')).toBe(false);});
});
