export const NOW = new Date("2026-11-08T12:00:00.000Z");
export const fixedClock = { now: () => NOW };

export const movie = (overrides = {}) => ({
  id: "m1",
  title: "Interestelar",
  genre: "Ficção Científica",
  rating: 8.6,
  membersRating: { average: 9.5, count: 2 },
  ...overrides
});

export const reviewEvent = (overrides = {}) => ({
  specversion: "1.0",
  id: "evt-1",
  source: "/moviehub/ms-avaliacoes",
  type: "moviehub.avaliacao.registrada",
  time: NOW.toISOString(),
  subject: "movies/m1",
  datacontenttype: "application/json",
  data: { reviewId: "r1", movieId: "m1", rating: 9 },
  ...overrides
});

/** Contexto mínimo do Azure Functions (InvocationContext) que guarda os logs. */
export function fakeContext(triggerMetadata = {}) {
  const logs = [];
  return {
    logs,
    triggerMetadata,
    log: (...args) => logs.push(["log", args.join(" ")]),
    warn: (...args) => logs.push(["warn", args.join(" ")]),
    error: (...args) => logs.push(["error", args.join(" ")])
  };
}

/** HttpRequest mínimo do Azure Functions. */
export const fakeRequest = (body) => ({
  json: async () => (typeof body === "string" ? JSON.parse(body) : body)
});
