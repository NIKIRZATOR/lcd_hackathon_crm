import { STAGE_BY_CODE, firstMissing, missingFactText, stageReadyText } from './nbaRules';
import type { NbaRecommendation, ProgramNbaContext, StageCode } from './nbaTypes';

export const resolveStageCode = (raw?: string | null): StageCode =>
  (raw && STAGE_BY_CODE[raw]) || 'unknown';

export const getNextBestAction = (ctx: ProgramNbaContext): NbaRecommendation => {
  const missing = firstMissing(ctx.facts);
  const text = missing ? missingFactText(missing, ctx.stageCode) : stageReadyText(ctx);

  return {
    priority: missing ? 'P1' : 'P2',
    code: missing ? missing.code : 'ready',
    text,
  };
};
