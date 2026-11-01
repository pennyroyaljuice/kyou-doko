import type {Place,Mode} from '@/lib/domain';
import {googlePlaceUrl,yahooUrl} from '@/lib/navigation';
import {MapPin,Navigation,ArrowUpRight} from 'lucide-react';
export default function CardMapLinks({destination,mode}:{destination:Place;mode:Mode}){return <div className="card-map-links" aria-label={destination.name+'を外部地図で開く'}><a className="card-google-link" href={googlePlaceUrl(destination)} target="_blank" rel="noopener noreferrer" aria-label={destination.name+'をGoogle Mapsで見る'}><MapPin size={15}/><span>Google Maps</span><ArrowUpRight size={12}/></a>{mode==='DRIVE'&&<a className="card-yahoo-link" href={yahooUrl(destination.point,destination.name)} aria-label={destination.name+'への経路をYahoo!カーナビで開く'}><Navigation size={15}/><span>Yahoo!カーナビ</span><ArrowUpRight size={12}/></a>}</div>;}
