import type {Place} from '@/lib/domain';
import {googlePlaceUrl,yahooPlaceUrl} from '@/lib/navigation';
import {ArrowUpRight} from 'lucide-react';
export default function PlaceLinks({destination}:{destination:Place}){return <div className="place-links"><a className="nav-link" href={googlePlaceUrl(destination)} target="_blank" rel="noopener noreferrer">Google Mapsで場所を見る <ArrowUpRight size={17}/></a><a className="nav-link yahoo-nav-link" href={yahooPlaceUrl(destination)} target="_blank" rel="noopener noreferrer">Yahoo!マップで場所を探す <ArrowUpRight size={17}/></a><p className="nav-note">Yahoo!マップでは検索結果から施設を選択してください。</p></div>;}
