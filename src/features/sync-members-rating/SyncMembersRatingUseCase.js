import { MoviesApi } from "../../application/ports/MoviesApi.js";
import { ReviewsApi } from "../../application/ports/ReviewsApi.js";
import { movieIdFromEvent } from "../../domain/reviewEvents.js";

/**
 * Caso de uso: ao receber um evento de avaliação, recalcula a nota dos
 * membros do filme e grava no microsserviço de filmes.
 *
 * A média é sempre recalculada a partir da fonte (microsserviço de
 * avaliações), então reprocessar o mesmo evento ou receber eventos fora de
 * ordem não deixa o dado errado (idempotente).
 */
export class SyncMembersRatingUseCase {
  #movies;
  #reviews;

  constructor({ moviesApi, reviewsApi }) {
    this.#movies = MoviesApi.ensure(moviesApi);
    this.#reviews = ReviewsApi.ensure(reviewsApi);
  }

  async execute(event) {
    const movieId = movieIdFromEvent(event);
    const { average, count } = await this.#reviews.getMovieStats(movieId);
    const result = await this.#movies.updateMembersRating(movieId, { average, count });
    return { movieId, average, count, result };
  }
}
