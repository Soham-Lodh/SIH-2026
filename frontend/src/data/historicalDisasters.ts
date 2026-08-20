import { EvidenceBundle } from '../types/disaster';

export interface HistoricalDisasterItem extends EvidenceBundle {
  year: number;
  numericCasualties: number;
  decade: '1990s' | '2000s' | '2010s' | '2020s';
  economicLossInrCr?: number;
}

/**
 * Historical archive data is loaded live from the API.
 * The client keeps this module only for shared types.
 */
export const HISTORICAL_DISASTERS_CATALOG: HistoricalDisasterItem[] = [];
