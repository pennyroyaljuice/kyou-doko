import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {googlePlaceUrl,yahooPlaceUrl} from '../lib/navigation';
import PlaceLinks from '../components/PlaceLinks';
import YahooNavigation from '../components/YahooNavigation';
const place={id:'ChIJ-example',name:'海 & 山公園',description:'東京都○○区1-2',category:'公園',point:{lat:35,lng:139}};
it('Googleは施設IDと名前・住所を指定し経路や座標のリンクにしない',()=>{const url=new URL(googlePlaceUrl(place));expect(url.pathname).toBe('/maps/search/');expect(url.searchParams.get('query_place_id')).toBe(place.id);expect(url.searchParams.get('query')).toBe(place.name+' '+place.description);for(const key of ['origin','destination','travelmode','lat','lon'])expect(url.searchParams.has(key)).toBe(false);});
it('Yahooは名前と住所で施設検索しカーナビの経路起動はしない',()=>{const url=new URL(yahooPlaceUrl(place));expect(url.origin).toBe('https://map.yahoo.co.jp');expect(url.pathname).toBe('/search');expect(url.searchParams.get('q')).toBe(place.name+' '+place.description);expect(url.searchParams.has('lat')).toBe(false);});
it('Googleは場所の詳細を開き、Yahooカーナビは現在地からの経路と往復指定を維持する',()=>{const google=renderToStaticMarkup(<PlaceLinks destination={place}/>);expect(google).toContain('Google Mapsで場所を見る');expect(google).not.toContain('maps/dir');expect(google).not.toContain('Yahoo!マップ');const yahoo=renderToStaticMarkup(<YahooNavigation origin={{lat:35.68,lng:139.76}} originLabel="東京駅" destination={place.point} name={place.name} roundTrip={true} avoidHighways={true} demo={false}/>);expect(yahoo).toContain('yjcarnavi://navi/select?');expect(yahoo).toContain('Yahoo!カーナビで目的地を開く');expect(yahoo).toContain('検索の出発地点から往路を開く');expect(yahoo).toContain('現在地から出発地点へ戻る');expect(yahoo).toContain('高速道路を避ける設定は引き継げません');});
