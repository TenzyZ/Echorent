// The supported pickup locations. The stub API in server/ serves the same
// data from shared/locations.json.
import locations from '../shared/locations.json';

export interface Location {
  code: string;
  name: string;
  currency: string;
}

export function getLocations(): Location[] {
  return locations;
}
