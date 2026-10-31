import type { Point, Place, Leg, Mode } from './domain';
export interface DiscoveryProvider {
  resolve(origin: string | Point): Promise<{ point: Point; label: string }>;
  nearby(origin: Point, radius: number): Promise<Place[]>;
  route(origin: Point, destination: Point, mode: Mode, departure: Date): Promise<Leg | null>;
}
