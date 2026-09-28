import { createContext, useContext } from 'react';

export type Period = [string, string] | null;

export const PeriodContext = createContext<Period>(null);

export const usePeriod = () => useContext(PeriodContext);

export const isInPeriod = (at: string | undefined, period: Period) => {
  if (!period) return true;
  if (!at) return false;
  return at >= period[0] && at <= period[1];
};
