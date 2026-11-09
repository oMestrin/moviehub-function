import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { HttpMoviesApi } from "../../src/infrastructure/http/HttpMoviesApi.js";
import { HttpReviewsApi } from "../../src/infrastructure/http/HttpReviewsApi.js";
import { UpstreamError } from "../../src/application/errors/UpstreamError.js";

// servidor HTTP local que faz o papel dos dois microsserviços
let server;
let baseUrl;
const received = [];

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
      const send = (status, payload) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(payload === undefined ? "" : JSON.stringify(payload));
      };
      if (req.url === "/movie-stats/m1") return send(200, { movieId: "m1", average: 8.5, count: 4 });
      if (req.url === "/movie-stats/vazio") return send(200, { movieId: "vazio", average: null, count: 0 });
      if (req.url === "/movie-stats/quebrado") return send(503, { error: "indisponível" });
      if (req.url === "/movies/m1/members-rating") return send(200, { id: "m1" });
      if (req.url === "/movies/inexistente/members-rating") return send(404, { error: "NotFound" });
      if (req.url === "/movies/quebrado/members-rating") return send(500, { error: "erro" });
      if (req.url === "/movies/invalido/members-rating") return send(400, { error: "ValidationError" });
      return send(404, { error: "NotFound" });
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});

after(() => server.close());

describe("HttpReviewsApi", () => {
  test("GET /movie-stats/:movieId", async () => {
    assert.deepEqual(await new HttpReviewsApi(baseUrl).getMovieStats("m1"), { movieId: "m1", average: 8.5, count: 4 });
    assert.deepEqual(received.at(-1), { method: "GET", url: "/movie-stats/m1", body: null });
  });

  test("filme sem avaliações", async () => {
    assert.deepEqual(await new HttpReviewsApi(baseUrl).getMovieStats("vazio"), { movieId: "vazio", average: null, count: 0 });
  });

  test("5xx vira UpstreamError", async () => {
    await assert.rejects(new HttpReviewsApi(baseUrl).getMovieStats("quebrado"), UpstreamError);
  });

  test("serviço fora do ar vira UpstreamError", async () => {
    await assert.rejects(new HttpReviewsApi("http://127.0.0.1:1").getMovieStats("m1"), UpstreamError);
  });
});

describe("HttpMoviesApi", () => {
  test("PATCH /movies/:id/members-rating com { average, count }", async () => {
    assert.equal(await new HttpMoviesApi(baseUrl).updateMembersRating("m1", { average: 8.5, count: 4 }), "updated");
    assert.deepEqual(received.at(-1), { method: "PATCH", url: "/movies/m1/members-rating", body: { average: 8.5, count: 4 } });
  });

  test("404 → not-found", async () => {
    assert.equal(await new HttpMoviesApi(baseUrl).updateMembersRating("inexistente", { average: 5, count: 1 }), "not-found");
  });

  test("5xx e 4xx inesperado viram UpstreamError", async () => {
    await assert.rejects(new HttpMoviesApi(baseUrl).updateMembersRating("quebrado", { average: 5, count: 1 }), UpstreamError);
    await assert.rejects(new HttpMoviesApi(baseUrl).updateMembersRating("invalido", { average: 5, count: 1 }), UpstreamError);
  });
});
