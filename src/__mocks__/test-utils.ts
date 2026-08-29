import { vi } from "vitest";
import { dictPreferencesDefaultValues } from "../utils/constants";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";

export const mockUserPrefsState = vi.fn();
export const mockUserPrefs = {
  ...dictPreferencesDefaultValues,
};
export const mockdbConnection = {
  current: {
    run: vi.fn().mockResolvedValue({ changes: { lastId: 1, changes: 1 } }),
    query: vi.fn().mockResolvedValue({ values: [] }),
    isDBOpen: vi.fn().mockResolvedValue({ result: true }),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
} as unknown as React.MutableRefObject<SQLiteDBConnection | undefined>;

export const mockSetUserLocations = vi.fn();

export const mockUserLocations = [
  {
    id: 1,
    isSelected: 0,
    latitude: 53.483959,
    locationName: "Manchester",
    longitude: -2.244644,
  },
  {
    id: 2,
    isSelected: 1,
    latitude: 25.286106,
    locationName: "Doha",
    longitude: 51.534817,
  },
  {
    id: 3,
    isSelected: 0,
    latitude: 43.0,
    locationName: "New York",
    longitude: -75.0,
  },
  {
    id: 7,
    isSelected: 0,
    latitude: 41.015137,
    locationName: "Istanbul",
    longitude: 28.97953,
  },
];
