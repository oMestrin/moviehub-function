import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildFunctions } from "../../src/container.js";
import { UpstreamError } from "../../src/application/errors/UpstreamError.js";
import { NOW, fakeContext, fakeRequest, fixedClock, movie, reviewEvent } from "../helpers/fakes.js";

function build({ updateResult = "updated", reviewsError } = {}) {
  const updates = [];
  const functions = buildFunctions({
    clock: fixedClock,
    queueName: "avaliacoes-eventos",
    reviewsApi: {
      async getMovieStats(movieId) {
        if (reviewsError) throw reviewsError;
        return { movieId, average: 9, count: 3 };
      }
    },
    moviesApi: {
      async updateMembersRating(movieId, rating) {
        updates.push([movieId, rating]);
        return updateResult;
      }
    }
  });
  return { updates, insights: functions.http[0], sync: functions.queue[0] };
}

describe("registro dos gatilhos", () => {
  test("gatilho HTTP POST /api/insights com chave de função", () => {
    const { insights } = build();
    assert.equal(insights.name, "insights");
    assert.deepEqual(insights.options, { methods: ["POST"], authLevel: "function", route: "insights" });
  });

  test("gatilho de fila na avaliacoes-eventos usando a conexão EventsStorage", () => {
    const { sync } = build();
    assert.equal(sync.name, "syncMembersRating");
    assert.deepEqual(sync.options, { queueName: "avaliacoes-eventos", connection: "EventsStorage" });
  });
});

describe("gatilho HTTP — insights", () => {
  test("200 com os insights", async () => {
    const { insights } = build();
    const response = await insights.handler(fakeRequest({ movies: [movie()] }), fakeContext());
    assert.equal(response.status, 200);
    assert.equal(response.jsonBody.generatedAt, NOW.toISOString());
    assert.equal(response.jsonBody.topRated[0].label, "Aclamado");
  });

  test("400 quando falta a lista de filmes", async () => {
    const { insights } = build();
    const response = await insights.handler(fakeRequest({}), fakeContext());
    assert.equal(response.status, 400);
    assert.equal(response.jsonBody.error, "ValidationError");
  });

  test("400 quando o JSON é inválido", async () => {
    const { insights } = build();
    const response = await insights.handler(fakeRequest("{oops"), fakeContext());
    assert.equal(response.status, 400);
  });
});

describe("gatilho de fila — sincronizar nota dos membros", () => {
  test("aceita a mensagem já convertida em objeto", async () => {
    const { sync, updates } = build();
    const context = fakeContext({ dequeueCount: 1 });
    await sync.handler(reviewEvent(), context);
    assert.deepEqual(updates, [["m1", { average: 9, count: 3 }]]);
    assert.ok(context.logs.some(([, msg]) => msg.includes("atualizada")));
  });

  test("aceita a mensagem como texto JSON", async () => {
    const { sync, updates } = build();
    await sync.handler(JSON.stringify(reviewEvent()), fakeContext());
    assert.equal(updates.length, 1);
  });

  test("evento inválido é descartado sem erro (não vai para retry)", async () => {
    const { sync, updates } = build();
    const context = fakeContext();
    await sync.handler({ type: "outro" }, context);
    assert.equal(updates.length, 0);
    assert.ok(context.logs.some(([level]) => level === "warn"));
  });

  test("filme removido: evento ignorado com aviso", async () => {
    const { sync } = build({ updateResult: "not-found" });
    const context = fakeContext();
    await sync.handler(reviewEvent(), context);
    assert.ok(context.logs.some(([level, msg]) => level === "warn" && msg.includes("não existe")));
  });

  test("falha de serviço sobe para o runtime tentar de novo", async () => {
    const { sync } = build({ reviewsError: new UpstreamError("ms-avaliacoes", "timeout") });
    await assert.rejects(sync.handler(reviewEvent(), fakeContext()), UpstreamError);
  });
});
