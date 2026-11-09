import { ValidationError } from "../../domain/errors/index.js";

/**
 * Gatilho de fila (Azure Storage Queue "avaliacoes-eventos").
 *
 * Recebe os CloudEvents publicados pelo microsserviço de avaliações. Se der
 * erro de rede ou 5xx, a exceção sobe e o runtime tenta de novo (até 5 vezes);
 * depois disso a mensagem vai para a fila "avaliacoes-eventos-poison".
 * Eventos inválidos são descartados com log, sem novas tentativas.
 */
export function syncMembersRatingFunction({ useCase, queueName = "avaliacoes-eventos" }) {
  return {
    name: "syncMembersRating",
    options: { queueName, connection: "EventsStorage" },
    async handler(message, context) {
      const event = typeof message === "string" ? JSON.parse(message) : message;
      context.log(`evento recebido: ${event?.type} id=${event?.id} (tentativa ${context.triggerMetadata?.dequeueCount ?? 1})`);
      try {
        const { movieId, average, count, result } = await useCase.execute(event);
        if (result === "not-found") {
          context.warn(`filme ${movieId} não existe mais; evento ignorado`);
          return;
        }
        context.log(`nota dos membros do filme ${movieId} atualizada: média ${average ?? "-"} (${count} avaliações)`);
      } catch (error) {
        if (error instanceof ValidationError) {
          context.warn(`evento descartado: ${error.message}`);
          return;
        }
        throw error;
      }
    }
  };
}
