/**
 * hazards.ts — display info for each hazard: label, icon, and whether leaving
 * the area can make sense (which decides if a route planner is ever offered).
 */
import type { IconName } from '../icons';
import type { HazardId } from './types';

export interface HazardInfo {
  id: HazardId;
  label: string;
  icon: IconName;
  /**
   * true = leaving can make sense (flooding, hurricanes, official evacuation orders).
   * false = shelter where you are; never suggest driving away (tornado, storms, cold, heat).
   */
  leaveable: boolean;
}

export const HAZARDS: Record<HazardId, HazardInfo> = {
  flood: { id: 'flood', label: 'Flooding', icon: 'Waves', leaveable: true },
  tornado: { id: 'tornado', label: 'Tornado', icon: 'Tornado', leaveable: false },
  severe_storm: { id: 'severe_storm', label: 'Severe storm', icon: 'CloudLightning', leaveable: false },
  tropical: { id: 'tropical', label: 'Tropical storm or hurricane', icon: 'CloudRainWind', leaveable: true },
  winter: { id: 'winter', label: 'Winter storm or ice', icon: 'Snowflake', leaveable: false },
  heat: { id: 'heat', label: 'Extreme heat', icon: 'ThermometerSun', leaveable: false },
  cold: { id: 'cold', label: 'Extreme cold', icon: 'ThermometerSnowflake', leaveable: false },
  wind: { id: 'wind', label: 'High wind', icon: 'Wind', leaveable: false },
  fire_weather: { id: 'fire_weather', label: 'Fire weather', icon: 'Flame', leaveable: false },
  fog: { id: 'fog', label: 'Fog or smoke', icon: 'CloudFog', leaveable: false },
  air_quality: { id: 'air_quality', label: 'Air quality', icon: 'Factory', leaveable: false },
  evacuation: { id: 'evacuation', label: 'Evacuation order', icon: 'DoorOpen', leaveable: true },
  other: { id: 'other', label: 'Other official alert', icon: 'CircleAlert', leaveable: false },
};
