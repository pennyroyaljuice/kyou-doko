import { isPoint, type Point } from './domain';
export type CurrentLocation = { point: Point; accuracy: number };
export function getCurrentLocation(geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined, secure: boolean): Promise<CurrentLocation> {
  if (!secure) return Promise.reject(new Error('位置情報にはHTTPS接続が必要です。出発地点を手入力してください。'));
  if (!geolocation) return Promise.reject(new Error('このブラウザーは位置情報に対応していません。出発地点を手入力してください。'));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(position => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (!isPoint(point)) { reject(new Error('有効な現在地を取得できませんでした。出発地点を手入力してください。')); return; }
      resolve({ point, accuracy: position.coords.accuracy });
    }, error => {
      const messages: Record<number, string> = {
        1: '位置情報の利用が許可されていません。ブラウザーのサイト設定で許可するか、出発地点を手入力してください。',
        2: '現在地を取得できませんでした。電波状況を確認して再試行するか、出発地点を手入力してください。',
        3: '現在地の取得がタイムアウトしました。再試行するか、出発地点を手入力してください。',
      };
      reject(new Error(messages[error.code] ?? '現在地を取得できませんでした。出発地点を手入力してください。'));
    }, { timeout: 15000, maximumAge: 0, enableHighAccuracy: true });
  });
}
