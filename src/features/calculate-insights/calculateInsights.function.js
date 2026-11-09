import { badRequest, ok } from "../../api/httpResponses.js";
import { ValidationError } from "../../domain/errors/index.js";

/**
 * Gatilho HTTP — POST /api/insights
 * Corpo: { "movies": [ { id, title, genre, rating, membersRating: { average, count } } ] }
 * Chamado pelo BFF no endpoint /aggregated-data (enriquecimento de dados).
 */
export function calculateInsightsFunction({ useCase, authLevel = "function" }) {
  return {
    name: "insights",
    options: { methods: ["POST"], authLevel, route: "insights" },
    async handler(request, context) {
      let body;
      try {
        body = await request.json();
      } catch {
        return badRequest("JSON inválido no corpo da requisição.");
      }
      try {
        const insights = useCase.execute({ movies: body?.movies });
        context.log(`insights calculados para ${insights.totalMovies} filmes`);
        return ok(insights);
      } catch (error) {
        if (error instanceof ValidationError) {
          return badRequest(error.message);
        }
        throw error;
      }
    }
  };
}
