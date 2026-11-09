import { ValidationError } from "./errors/index.js";

/** Domínio — tipos de evento publicados pelo microsserviço de avaliações. */
export const REVIEW_EVENT_TYPES = Object.freeze([
  "moviehub.avaliacao.registrada",
  "moviehub.avaliacao.atualizada",
  "moviehub.avaliacao.removida"
]);

/** Valida o CloudEvent recebido e devolve o id do filme afetado. */
export function movieIdFromEvent(event) {
  if (!event || !REVIEW_EVENT_TYPES.includes(event.type)) {
    throw new ValidationError(`Evento não suportado: ${event?.type ?? "(sem tipo)"}.`);
  }
  const movieId = event.data?.movieId;
  if (typeof movieId !== "string" || movieId.trim() === "") {
    throw new ValidationError("Evento sem data.movieId.");
  }
  return movieId;
}
