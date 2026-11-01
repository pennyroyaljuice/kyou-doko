import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {googlePlaceUrl,yahooPlaceUrl} from '../lib/navigation';
import PlaceLinks from '../components/PlaceLinks';
const place={id:'ChIJ-example',name:'海 & 山公園',description:'東京都○○区1-2',category:'公園',point:{lat:35,lng:139}};
it('Googleは施設IDと名前・住所を指定し経路や座標のリンクにしない',()=>{const url=new URL(googlePlaceUrl(place));expect(url.pathname).toBe('/maps/search/');expect(url.searchParams.get('query_place_id')).toBe(place.id);expect(url.searchParams.get('query')).toBe(place.name+' '+place.description);for(const key of ['origin','destination','travelmode','lat','lon'])expect(url.searchParams.has(key)).toBe(false);});
it('Yahooは名前と住所で施設検索しカーナビの経路起動はしない',()=>{const url=new URL(yahooPlaceUrl(place));expect(url.origin).toBe('https://map.yahoo.co.jp');expect(url.pathname).toBe('/search');expect(url.searchParams.get('q')).toBe(place.name+' '+place.description);expect(url.searchParams.has('lat')).toBe(false);});
it('画面上のリンクは場所を見る操作で、復路・往路のリンクを表示しない',()=>{const html=renderToStaticMarkup(<PlaceLinks destination={place}/>);expect(html).toContain('Google Mapsで場所を見る');expect(html).toContain('Yahoo!マップで場所を探す');expect(html).not.toContain('maps/dir');expect(html).not.toContain('yjcarnavi:');expect(html).not.toContain('往路');expect(html).not.toContain('復路');});
