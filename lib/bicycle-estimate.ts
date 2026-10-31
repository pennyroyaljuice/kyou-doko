import type {Leg} from './domain';
// Planning assumption, not a measured cycling speed or bicycle-safe route.
export const bicycleSpeedKmh=15;
export function estimateBicycleLeg(walking:Leg):Leg{return {meters:walking.meters,seconds:walking.meters*3.6/bicycleSpeedKmh};}
