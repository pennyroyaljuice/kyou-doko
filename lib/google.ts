import { photoTicket } from './photos';
import { AppError, isPoint, type Point, type Place, type Leg, type Mode } from './domain';
import type { DiscoveryProvider } from './providers';
type GooglePlace = { photos?: {name:string;authorAttributions?:{displayName:string;uri?:string}[]}[]; id: string; displayName?: {text:string}; formattedAddress?: string; location?: {latitude:number;longitude:number}; primaryTypeDisplayName?: {text:string}; attributions?: {provider:string;providerUri:string}[] };
const fields = 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.attributions,places.photos';
export class GoogleProvider implements DiscoveryProvider {
  constructor(private key: string) {}
  private async request<T>(url: string, body: unknown, mask: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','X-Goog-Api-Key':this.key,'X-Goog-FieldMask':mask}, body:JSON.stringify(body), cache:'no-store', signal:AbortSignal.timeout(10000) });
    } catch { throw new AppError('Googleへの接続がタイムアウト、または失敗しました。時間をおいて再検索してください。',502); }
    if (!response.ok) {
      if (response.status === 429) throw new AppError('Google APIの利用上限に達しました。割当と課金設定を確認してください。',503);
      if ([401,403].includes(response.status)) throw new AppError('Google APIの認証・API有効化・課金設定を確認してください。',502);
      if (response.status === 400) throw new AppError('指定地域・移動手段・検索条件をGoogle APIで処理できませんでした。別の条件をお試しください。',422);
      throw new AppError('Google APIでエラーが発生しました。デモには切り替えていません。',502);
    }
    return response.json() as Promise<T>;
  }
  async resolve(origin: string | Point) {
    if (isPoint(origin)) return {point:origin,label:`${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}`};
    const coords = origin.split(',').map(s=>Number(s.trim()));
    if (coords.length === 2 && origin.split(',').every(s=>s.trim()) && isPoint({lat:coords[0],lng:coords[1]})) return {point:{lat:coords[0],lng:coords[1]},label:origin};
    const data = await this.request<{places?:GooglePlace[]}>('https://places.googleapis.com/v1/places:searchText',{textQuery:origin,languageCode:'ja',maxResultCount:1},'places.location,places.displayName,places.formattedAddress');
    const p = data.places?.[0];
    if (!p?.location) throw new AppError('出発地点が見つかりませんでした。駅名・住所・緯度,経度で指定してください。',422);
    return {point:{lat:p.location.latitude,lng:p.location.longitude},label:p.displayName?.text ?? origin};
  }
  async nearby(origin: Point, radius: number): Promise<Place[]> {
    const data = await this.request<{places?:GooglePlace[]}>('https://places.googleapis.com/v1/places:searchNearby',{
      includedTypes:['tourist_attraction','park','national_park','beach','hiking_area','observation_deck'],maxResultCount:8,languageCode:'ja',rankPreference:'POPULARITY',locationRestriction:{circle:{center:{latitude:origin.lat,longitude:origin.lng},radius}}
    },fields);
    return Promise.all((data.places??[]).filter(p=>p.location).map(async p=>({id:p.id,name:p.displayName?.text??'名称不明',point:{lat:p.location!.latitude,lng:p.location!.longitude},category:p.primaryTypeDisplayName?.text??'お出かけスポット',description:p.formattedAddress??'住所情報なし',attributions:p.attributions?.map(a=>({name:a.provider,uri:a.providerUri})),photo:await this.photo(p)})));
  }
  private async photo(place:GooglePlace) {
    const first=place.photos?.[0],secret=this.key;
    if(!first||!secret)return undefined;
    const ticket=await photoTicket(first.name,secret);
    return ticket?{ticket,authors:(first.authorAttributions??[]).map(a=>({name:a.displayName,uri:a.uri}))}:undefined;
  }
  async route(origin: Point, destination: Point, mode: Mode, departure: Date, options?: { avoidHighways?: boolean }): Promise<Leg|null> {
    const waypoint = (p:Point)=>({location:{latLng:{latitude:p.lat,longitude:p.lng}}});
    const data = await this.request<{routes?:{duration:string;distanceMeters:number;polyline?:{encodedPolyline:string}}[]}>('https://routes.googleapis.com/directions/v2:computeRoutes',{
      origin:waypoint(origin),destination:waypoint(destination),travelMode:mode,languageCode:'ja',units:'METRIC',computeAlternativeRoutes:false,
      ...(mode === 'DRIVE' ? {routingPreference:'TRAFFIC_UNAWARE',routeModifiers:{avoidHighways:options?.avoidHighways === true}} : {}),
      ...(mode === 'TRANSIT' ? {departureTime:departure.toISOString(),transitPreferences:{allowedTravelModes:['TRAIN','SUBWAY','LIGHT_RAIL','RAIL']}} : {})
    },'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline');
    const route = data.routes?.[0];
    if (!route) return null;
    const seconds = Number(route.duration?.replace(/s$/,''));
    if (!Number.isFinite(seconds) || !Number.isFinite(route.distanceMeters)) throw new AppError('Googleから有効な経路の時間・距離を取得できませんでした。',502);
    return {seconds,meters:route.distanceMeters,polyline:route.polyline?.encodedPolyline};
  }
}
