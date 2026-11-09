import { defineInterface } from "../../shared/kernel/defineInterface.js";

/**
 * Porta de saída — microsserviço de filmes.
 * updateMembersRating(movieId, { average, count }) -> Promise<"updated" | "not-found">
 */
export const MoviesApi = defineInterface("MoviesApi", ["updateMembersRating"]);
