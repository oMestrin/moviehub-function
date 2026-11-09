import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PRIOR_WEIGHT, computeInsights, labelOf, scoreOf } from "../../src/domain/insights.js";
import { movieIdFromEvent } from "../../src/domain/reviewEvents.js";
import { ValidationError } from "../../src/domain/errors/index.js";
import { NOW, movie, reviewEvent } from "../helpers/fakes.js";

describe("score (média bayesiana crítica x membros)", () => {
  test("sem avaliações de membros, o score é a nota da crítica", () => {
    assert.equal(scoreOf({ rating: 7.3, membersRating: { average: null, count: 0 } }), 7.3);
    assert.equal(scoreOf({ rating: 7.3 }), 7.3);
  });

  test("a crítica pesa como PRIOR_WEIGHT avaliações", () => {
    assert.equal(PRIOR_WEIGHT, 3);
    // (8 * 3 + 10 * 1) / 4 = 8.5
    assert.equal(scoreOf({ rating: 8, membersRating: { average: 10, count: 1 } }), 8.5);
  });

  test("com muitos membros, o score se aproxima da média deles", () => {
    const score = scoreOf({ rating: 5, membersRating: { average: 9, count: 300 } });
    assert.ok(score > 8.9 && score <= 9);
  });

  test("arredonda para uma casa decimal", () => {
    // (8.6 * 3 + 9.5 * 2) / 5 = 8.96
    assert.equal(scoreOf(movie()), 9);
  });
});

describe("classificação", () => {
  for (const [score, label] of [[9.4, "Aclamado"], [9, "Aclamado"], [8.9, "Muito bom"], [8, "Muito bom"], [7, "Bom"], [6.5, "Bom"], [5.5, "Mediano"], [5, "Mediano"], [4.9, "Fraco"], [0, "Fraco"]]) {
    test(`${score} → ${label}`, () => assert.equal(labelOf(score), label));
  }
});

describe("computeInsights", () => {
  const movies = [
    movie({ id: "m1", title: "Interestelar", genre: "Ficção Científica", rating: 8.6, membersRating: { average: 9.5, count: 2 } }),
    movie({ id: "m2", title: "Matrix", genre: "Ficção Científica", rating: 8.7, membersRating: { average: 9, count: 3 } }),
    movie({ id: "m3", title: "Cidade de Deus", genre: "Drama", rating: 8.6, membersRating: { average: null, count: 0 } }),
    movie({ id: "m4", title: "Divertida Mente", genre: "Animação", rating: 8.1, membersRating: { average: 7.5, count: 2 } })
  ];

  test("totais e médias", () => {
    const result = computeInsights(movies, NOW);
    assert.equal(result.generatedAt, NOW.toISOString());
    assert.equal(result.totalMovies, 4);
    assert.equal(result.totalReviews, 7);
    assert.equal(result.averageCriticsRating, 8.5);
    // média ponderada pelos votos: (9.5*2 + 9*3 + 7.5*2) / 7 = 8.71
    assert.equal(result.averageMembersRating, 8.7);
  });

  test("top 3 por score, empate desfeito pelo título", () => {
    const { topRated } = computeInsights(movies, NOW);
    assert.deepEqual(topRated.map((m) => m.movieId), ["m1", "m2", "m3"]);
    assert.deepEqual(topRated[0], { movieId: "m1", title: "Interestelar", genre: "Ficção Científica", score: 9, label: "Aclamado" });
  });

  test("médias por gênero, da maior para a menor", () => {
    const { byGenre } = computeInsights(movies, NOW);
    assert.deepEqual(byGenre, [
      { genre: "Ficção Científica", movies: 2, averageScore: 9 },
      { genre: "Drama", movies: 1, averageScore: 8.6 },
      { genre: "Animação", movies: 1, averageScore: 7.9 }
    ]);
  });

  test("uma classificação por filme, na ordem recebida", () => {
    const { classifications } = computeInsights(movies, NOW);
    assert.deepEqual(classifications.map((c) => [c.movieId, c.label]), [["m1", "Aclamado"], ["m2", "Muito bom"], ["m3", "Muito bom"], ["m4", "Bom"]]);
  });

  test("lista vazia", () => {
    const result = computeInsights([], NOW);
    assert.equal(result.totalMovies, 0);
    assert.equal(result.averageCriticsRating, null);
    assert.equal(result.averageMembersRating, null);
    assert.deepEqual(result.topRated, []);
    assert.deepEqual(result.byGenre, []);
  });

  test("rejeita entrada inválida", () => {
    assert.throws(() => computeInsights(undefined, NOW), ValidationError);
    assert.throws(() => computeInsights([{ title: "x" }], NOW), ValidationError);
    assert.throws(() => computeInsights([movie({ rating: 11 })], NOW), ValidationError);
    assert.throws(() => computeInsights([movie({ membersRating: { average: 5, count: -1 } })], NOW), ValidationError);
  });
});

describe("eventos de avaliação", () => {
  test("extrai o id do filme dos três tipos de evento", () => {
    for (const type of ["moviehub.avaliacao.registrada", "moviehub.avaliacao.atualizada", "moviehub.avaliacao.removida"]) {
      assert.equal(movieIdFromEvent(reviewEvent({ type })), "m1");
    }
  });

  test("rejeita tipo desconhecido ou evento sem movieId", () => {
    assert.throws(() => movieIdFromEvent(reviewEvent({ type: "outro.evento" })), ValidationError);
    assert.throws(() => movieIdFromEvent(reviewEvent({ data: {} })), ValidationError);
    assert.throws(() => movieIdFromEvent(null), ValidationError);
  });
});
