import { CalculateInsightsUseCase } from "./features/calculate-insights/CalculateInsightsUseCase.js";
import { calculateInsightsFunction } from "./features/calculate-insights/calculateInsights.function.js";
import { SyncMembersRatingUseCase } from "./features/sync-members-rating/SyncMembersRatingUseCase.js";
import { syncMembersRatingFunction } from "./features/sync-members-rating/syncMembersRating.function.js";
import { HttpMoviesApi } from "./infrastructure/http/HttpMoviesApi.js";
import { HttpReviewsApi } from "./infrastructure/http/HttpReviewsApi.js";
import { SystemClock } from "./infrastructure/SystemClock.js";

/**
 * Composition root: liga infraestrutura -> casos de uso -> gatilhos.
 * Recebe a configuração pronta (lida do ambiente em index.js).
 */
export function buildFunctions({ moviesServiceUrl, reviewsServiceUrl, queueName, insightsAuthLevel, clock = new SystemClock(), moviesApi, reviewsApi }) {
  const insights = new CalculateInsightsUseCase({ clock });
  const sync = new SyncMembersRatingUseCase({
    moviesApi: moviesApi ?? new HttpMoviesApi(moviesServiceUrl),
    reviewsApi: reviewsApi ?? new HttpReviewsApi(reviewsServiceUrl)
  });

  return {
    http: [calculateInsightsFunction({ useCase: insights, authLevel: insightsAuthLevel })],
    queue: [syncMembersRatingFunction({ useCase: sync, queueName })]
  };
}
