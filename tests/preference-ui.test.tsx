import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import DestinationCard from '../components/DestinationCard';
import PlacePreferences from '../components/PlacePreferences';
import {demoSearch} from '../lib/demo';
const d=demoSearch({source:'demo',origin:'東京駅',mode:'DRIVE',metric:'time',budget:120,roundTrip:false}).destinations[0];
it('候補カードの選択ボタンの外に短いチェック文言を表示',()=>{const html=renderToStaticMarkup(<DestinationCard destination={d} index={0} selected={false} onSelect={()=>{}} roundTrip={false} preference="visited" onPreference={()=>{}}/>);expect(html).toContain('訪問済み');expect(html).toContain('興味なし');expect(html).toContain('checked=""');expect(html.indexOf('card-preferences')).toBeGreaterThan(html.indexOf('</button>'));expect(html).not.toContain('訪問済みにする');});
it('検索結果なしでも保存した区分の一覧を表示できる',()=>{const html=renderToStaticMarkup(<PlacePreferences prefs={{excludeVisited:true,places:{ChIJabcdefghijk:'visited',ChIJabcdefghijl:'uninterested'}}} saving={false} error="" save={async()=>{}}/>);expect(html).toContain('保存した場所');expect(html).toContain('訪問済み（1）');expect(html).toContain('興味なし（1）');expect(html).toContain('query_place_id=ChIJabcdefghijk');expect(html).not.toContain('query_place_id=ChIJabcdefghijl');});
