import { AppError, totals, rank, type SearchInput, type SearchResult, type Place } from './domain';
export const demoOrigin = {lat:35.68124,lng:139.76712};
const places: (Place & {km:number;minutes:number})[] = [
 {id:'kasai',name:'葛西臨海公園',category:'海辺・公園',description:'海風を感じて、いつもと違う休日を。広い空と水辺が広がる公園。',point:{lat:35.6401,lng:139.8615},km:17,minutes:32},
 {id:'wakasu',name:'若洲海浜公園',category:'海辺・展望',description:'東京ゲートブリッジを眺めながら、海沿いをゆっくり歩こう。',point:{lat:35.6168,lng:139.8384},km:18,minutes:37},
 {id:'showa',name:'国営昭和記念公園',category:'自然・公園',description:'木漏れ日と季節の彩り。大きな公園で、深呼吸する時間を。',point:{lat:35.7108,lng:139.3995},km:42,minutes:54},
 {id:'todoroki',name:'等々力渓谷',category:'自然・渓谷',description:'街の中の緑の谷へ。散策路の開放状況は出発前に確認しよう。',point:{lat:35.6034,lng:139.6477},km:22,minutes:44},
 {id:'odaiba',name:'お台場海浜公園',category:'海辺・夕景',description:'水平線と街のシルエット。気軽に海を見に行きたい日に。',point:{lat:35.6295,lng:139.7753},km:12,minutes:26},
 {id:'hibiya',name:'日比谷公園',category:'緑・街歩き',description:'都心の緑にひと休み。ベンチに座って、何もしない時間も。',point:{lat:35.6736,lng:139.7557},km:2,minutes:9},
 {id:'imperial',name:'皇居外苑',category:'散歩・景色',description:'広い空と歴史の風景。いつもの街を少し違う目線で。',point:{lat:35.6774,lng:139.7600},km:1.4,minutes:7},
 {id:'ueno',name:'上野恩賜公園',category:'公園・文化',description:'木々の間を歩いて、気の向くままに文化と自然にふれる。',point:{lat:35.7148,lng:139.7743},km:5,minutes:16}
];
export function demoSearch(input:SearchInput):SearchResult {
  if (typeof input.origin !== 'string' || !['東京駅','東京駅（デモ固定）'].includes(input.origin)) throw new AppError('デモの出発地点は東京駅固定です。任意地点やGPSには実APIモードを選んでください。');
  const all = places.map(p=>{
    const meters = p.km*1000;
    const seconds = input.mode === 'DRIVE' ? p.minutes*60 : input.mode === 'TRANSIT' ? (p.minutes+12)*60 : meters / (input.mode === 'WALK' ? 4.5 : 16) * 3.6;
    return totals(p,{meters,seconds},input.roundTrip?{meters:meters*1.03,seconds:seconds*1.08}:undefined);
  });
  return {source:'demo',origin:demoOrigin,originLabel:'東京駅（デモ固定）',input,destinations:rank(all,input),notices:[...(input.mode === 'DRIVE' ? ['デモの時間・距離は固定サンプルです。高速道路設定による経路・到達範囲の変化は通常検索で確認してください。'] : []),'すべて操作確認用のデモ数値です。実際の経路検索・時刻・距離ではありません。']};
}
