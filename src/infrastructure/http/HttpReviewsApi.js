import { UpstreamError } from "../../application/errors/UpstreamError.js";
import { fetchJson } from "./fetchJson.js";

/** Infraestrutura — cliente HTTP do microsserviço de avaliações. Implementa a porta ReviewsApi. */
export class HttpReviewsApi {
  #baseUrl;

  constructor(baseUrl) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getMovieStats(movieId) {
    const { status, body } = await fetchJson("ms-avaliacoes", `${this.#baseUrl}/movie-stats/${encodeURIComponent(movieId)}`);
    if (status !== 200) {
      throw new UpstreamError("ms-avaliacoes", `estatísticas do filme ${movieId}: status ${status}`);
    }
    return { movieId, average: body.average ?? null, count: body.count ?? 0 };
  }
}
