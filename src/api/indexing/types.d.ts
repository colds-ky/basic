
/**
 * One registration store per about 50,000 registrations.
 * Regsitration store should not span several months.
 *
 * Start a chain of registration stores at /inception.json
 *
 * Subsequent will be /2022-11/<time-based>.json
 */
type RegistrationStore = Map<string, RegistrationHistory> & {
  file: string;
  next?: string;
  earliestRegistration: number;
  latestRegistration: number;
  latestAction: number;
};

interface RegistrationHistory {
  created: number;
  updates: { [timestampOrOffset: string]: HistoryChange };
}

interface HistoryChange {
  /** shortHandle */
  h?: string;

  /** shortPLC */
  p?: string;
}