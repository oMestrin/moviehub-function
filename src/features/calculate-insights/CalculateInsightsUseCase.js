import { Clock } from "../../application/ports/Clock.js";
import { computeInsights } from "../../domain/insights.js";

/** Caso de uso: calcular os insights (ranking, classificação, médias por gênero) de uma lista de filmes. */
export class CalculateInsightsUseCase {
  #clock;

  constructor({ clock }) {
    this.#clock = Clock.ensure(clock);
  }

  execute({ movies }) {
    return computeInsights(movies, this.#clock.now());
  }
}
