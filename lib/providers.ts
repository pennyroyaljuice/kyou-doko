import type { DestinationTheme } from './themes';
import type { Point, Place, Leg, Mode, SearchInput } from './domain';
export interface DiscoveryProvider {
  resolve(origin: string | Point): Promise<{ point: Point; label: string }>;
  discover?(origin: Point, input: SearchInput): Promise<Place[]>;
  fallback?(origin:Point,input:SearchInput,area?:{center:Point;radius:number}):Promise<Place[]>;
  nearby(origin: Point, radius: number, theme?: DestinationTheme): Promise<Place[]>;
  route(origin: Point, destination: Point, mode: Mode, departure: Date, options?: { avoidHighways?: boolean }): Promise<Leg | null>;
}
