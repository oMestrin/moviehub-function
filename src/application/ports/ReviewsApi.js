import { defineInterface } from "../../shared/kernel/defineInterface.js";

/**
 * Porta de saída — microsserviço de avaliações.
 * getMovieStats(movieId) -> Promise<{ movieId, average: number|null, count }>
 */
export const ReviewsApi = defineInterface("ReviewsApi", ["getMovieStats"]);
