import type {Point} from './domain';
export function embedPlaceUrl(key:string,place:{id:string;point:Point}) {
 const q=/^[A-Za-z0-9_-]{10,}$/.test(place.id)?'place_id:'+place.id:place.point.lat+','+place.point.lng;
 return 'https://www.google.com/maps/embed/v1/place?'+new URLSearchParams({key,q,language:'ja',region:'JP',zoom:'12'});
}
