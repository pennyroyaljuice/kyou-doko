import type {Place} from '@/lib/domain';
import {googlePlaceUrl} from '@/lib/navigation';
import {ArrowUpRight} from 'lucide-react';
export default function PlaceLinks({destination}:{destination:Place}){return <div className="place-links"><a className="nav-link" href={googlePlaceUrl(destination)} target="_blank" rel="noopener noreferrer">Google Mapsで場所を見る <ArrowUpRight size={17}/></a></div>;}
