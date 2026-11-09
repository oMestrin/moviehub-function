import { app } from "@azure/functions";
import { buildFunctions } from "./container.js";

/**
 * Ponto de entrada do Azure Functions (modelo de programação v4).
 *
 * App settings:
 *   MOVIES_SERVICE_URL    URL do microsserviço de filmes (ex.: https://ms-filmes.<...>.azurecontainerapps.io)
 *   REVIEWS_SERVICE_URL   URL do microsserviço de avaliações
 *   EventsStorage         connection string do Storage Account onde fica a fila de eventos
 *   EVENTS_QUEUE_NAME     nome da fila (padrão "avaliacoes-eventos")
 *   INSIGHTS_AUTH_LEVEL   nível de autenticação do gatilho HTTP (padrão "function": exige a chave)
 */
const functions = buildFunctions({
  moviesServiceUrl: process.env.MOVIES_SERVICE_URL ?? "http://localhost:3001",
  reviewsServiceUrl: process.env.REVIEWS_SERVICE_URL ?? "http://localhost:3002",
  queueName: process.env.EVENTS_QUEUE_NAME ?? "avaliacoes-eventos",
  insightsAuthLevel: process.env.INSIGHTS_AUTH_LEVEL ?? "function"
});

for (const fn of functions.http) {
  app.http(fn.name, { ...fn.options, handler: fn.handler });
}
for (const fn of functions.queue) {
  app.storageQueue(fn.name, { ...fn.options, handler: fn.handler });
}
