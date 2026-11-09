import { UpstreamError } from "../../application/errors/UpstreamError.js";
import { fetchJson } from "./fetchJson.js";

/** Infraestrutura — cliente HTTP do microsserviço de filmes. Implementa a porta MoviesApi. */
export class HttpMoviesApi {
  #baseUrl;

  constructor(baseUrl) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
  }

  async updateMembersRating(movieId, { average, count }) {
    const { status } = await fetchJson("ms-filmes", `${this.#baseUrl}/movies/${encodeURIComponent(movieId)}/members-rating`, {
      method: "PATCH",
      body: { average, count }
    });
    if (status === 404) {
      return "not-found";
    }
    if (status !== 200) {
      throw new UpstreamError("ms-filmes", `atualizar nota do filme ${movieId}: status ${status}`);
    }
    return "updated";
  }
}
