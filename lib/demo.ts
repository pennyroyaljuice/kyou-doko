import { AppError, totals, rank, type SearchInput, type SearchResult, type Place } from './domain';
export const demoOrigin = {lat:35.68124,lng:139.76712};
const places: (Place & {km:number;minutes:number})[] = [
 {id:'kasai',name:'葛西臨海公園',category:'海辺・公園',description:'海風を感じて、いつもと違う休日を。広い空と水辺が広がる公園。',point:{lat:35.6401,lng:139.8615},km:17,minutes:32},
 {id:'wakasu',name:'若洲海浜公園',category:'海辺・展望',description:'東京ゲートブリッジを眺めながら、海沿いをゆっくり歩こう。',point:{lat:35.6168,lng:139.8384},km:18,minutes:37},
 {id:'showa',name:'国営昭和記念公園',category:'自然・公園',description:'木漏れ日と季節の彩り。大きな公園で、深呼吸する時間を。',point:{lat:35.7108,lng:139.3995},km:42,minutes:54},
 {id:'todoroki',name:'等々力渓谷',category:'自然・渓谷',description:'街の中の緑の谷へ。散策路の開放状況は出発前に確認しよう。',point:{lat:35.6034,lng:139.6477},km:22,minutes:44},
 {id:'disney',name:'東京ディズニーランド',category:'テーマパーク',description:'観光・レジャーの操作確認用サンプル。営業状況・チケットは公式情報をご確認ください。',point:{lat:35.6329,lng:139.8804},km:20,minutes:35},
 {id:'hibiya',name:'日比谷公園',category:'緑・街歩き',description:'都心の緑にひと休み。ベンチに座って、何もしない時間も。',point:{lat:35.6736,lng:139.7557},km:2,minutes:9},
 {id:'imperial',name:'皇居外苑',category:'散歩・景色',description:'広い空と歴史の風景。いつもの街を少し違う目線で。',point:{lat:35.6774,lng:139.7600},km:1.4,minutes:7},
 {id:'museum',name:'東京国立博物館',category:'博物館',description:'観光・文化施設の操作確認用サンプル。開館日・料金は公式情報をご確認ください。',point:{lat:35.7188,lng:139.7765},km:5,minutes:16}
];
export function demoSearch(input:SearchInput):SearchResult {
  if (input.mode === 'TRANSIT') throw new AppError('電車検索は現在提供していません。',422);
  if (typeof input.origin !== 'string' || !['東京駅','東京駅（デモ固定）'].includes(input.origin)) throw new AppError('デモの出発地点は東京駅固定です。任意地点やGPSには実APIモードを選んでください。');
  const tourismIds = ['imperial','museum','disney'];
  const all = places.filter(p=>!input.theme || input.theme === 'all' || (input.theme === 'tourism' ? tourismIds.includes(p.id) : !tourismIds.includes(p.id))).map(p=>{
    const meters = p.km*1000;
    const seconds = input.mode === 'DRIVE' ? p.minutes*60 : meters / (input.mode === 'WALK' ? 4.5 : 16) * 3.6;
    return totals(p,{meters,seconds},input.roundTrip?{meters:meters*1.03,seconds:seconds*1.08}:undefined);
  });
  return {source:'demo',origin:demoOrigin,originLabel:'東京駅（デモ固定）',input,destinations:rank(all,input),notices:[...(input.mode === 'DRIVE' ? ['デモの時間・距離は固定サンプルです。高速道路設定による経路・到達範囲の変化は通常検索で確認してください。'] : []),'すべて操作確認用のデモ数値です。実際の経路検索・時刻・距離ではありません。']};
}
