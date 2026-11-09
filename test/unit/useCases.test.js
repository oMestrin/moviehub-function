import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CalculateInsightsUseCase } from "../../src/features/calculate-insights/CalculateInsightsUseCase.js";
import { SyncMembersRatingUseCase } from "../../src/features/sync-members-rating/SyncMembersRatingUseCase.js";
import { UpstreamError } from "../../src/application/errors/UpstreamError.js";
import { ValidationError } from "../../src/domain/errors/index.js";
import { NOW, fixedClock, movie, reviewEvent } from "../helpers/fakes.js";

function fakeApis({ stats = { average: 8.5, count: 4 }, updateResult = "updated", reviewsError, moviesError } = {}) {
  const calls = [];
  const reviewsApi = {
    async getMovieStats(movieId) {
      calls.push(["getMovieStats", movieId]);
      if (reviewsError) throw reviewsError;
      return { movieId, ...stats };
    }
  };
  const moviesApi = {
    async updateMembersRating(movieId, rating) {
      calls.push(["updateMembersRating", movieId, rating]);
      if (moviesError) throw moviesError;
      return updateResult;
    }
  };
  return { calls, reviewsApi, moviesApi };
}

describe("CalculateInsightsUseCase", () => {
  test("usa o relógio injetado", () => {
    const result = new CalculateInsightsUseCase({ clock: fixedClock }).execute({ movies: [movie()] });
    assert.equal(result.generatedAt, NOW.toISOString());
    assert.equal(result.totalMovies, 1);
  });

  test("exige um Clock válido", () => {
    assert.throws(() => new CalculateInsightsUseCase({ clock: {} }), /Clock/);
  });
});

describe("SyncMembersRatingUseCase", () => {
  test("busca as estatísticas no ms-avaliacoes e grava no ms-filmes", async () => {
    const { calls, reviewsApi, moviesApi } = fakeApis();
    const result = await new SyncMembersRatingUseCase({ reviewsApi, moviesApi }).execute(reviewEvent());
    assert.deepEqual(calls, [["getMovieStats", "m1"], ["updateMembersRating", "m1", { average: 8.5, count: 4 }]]);
    assert.deepEqual(result, { movieId: "m1", average: 8.5, count: 4, result: "updated" });
  });

  test("quando a última avaliação é removida, grava média nula e zero avaliações", async () => {
    const { calls, reviewsApi, moviesApi } = fakeApis({ stats: { average: null, count: 0 } });
    await new SyncMembersRatingUseCase({ reviewsApi, moviesApi }).execute(reviewEvent({ type: "moviehub.avaliacao.removida" }));
    assert.deepEqual(calls[1], ["updateMembersRating", "m1", { average: null, count: 0 }]);
  });

  test("é idempotente: o mesmo evento duas vezes grava o mesmo valor", async () => {
    const { calls, reviewsApi, moviesApi } = fakeApis();
    const useCase = new SyncMembersRatingUseCase({ reviewsApi, moviesApi });
    await useCase.execute(reviewEvent());
    await useCase.execute(reviewEvent());
    assert.deepEqual(calls[1], calls[3]);
  });

  test("filme inexistente devolve not-found", async () => {
    const { reviewsApi, moviesApi } = fakeApis({ updateResult: "not-found" });
    const result = await new SyncMembersRatingUseCase({ reviewsApi, moviesApi }).execute(reviewEvent());
    assert.equal(result.result, "not-found");
  });

  test("evento inválido não chama nenhum serviço", async () => {
    const { calls, reviewsApi, moviesApi } = fakeApis();
    await assert.rejects(new SyncMembersRatingUseCase({ reviewsApi, moviesApi }).execute({ type: "x" }), ValidationError);
    assert.equal(calls.length, 0);
  });

  test("falha de um serviço sobe como UpstreamError (para o runtime tentar de novo)", async () => {
    const { reviewsApi, moviesApi } = fakeApis({ reviewsError: new UpstreamError("ms-avaliacoes", "timeout") });
    await assert.rejects(new SyncMembersRatingUseCase({ reviewsApi, moviesApi }).execute(reviewEvent()), UpstreamError);
  });

  test("exige as portas", () => {
    assert.throws(() => new SyncMembersRatingUseCase({ reviewsApi: {}, moviesApi: {} }), /ReviewsApi|MoviesApi/);
  });
});
