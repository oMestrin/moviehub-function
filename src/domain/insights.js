import { ValidationError } from "./errors/index.js";

/**
 * Domínio — cálculo dos insights do catálogo (função pura, sem I/O).
 *
 * score: média bayesiana entre a nota da crítica e a nota dos membros.
 * A nota da crítica pesa como PRIOR_WEIGHT avaliações; quanto mais membros
 * avaliam, mais o score se aproxima da opinião deles.
 */
export const PRIOR_WEIGHT = 3;

const LABELS = [
  [9, "Aclamado"],
  [8, "Muito bom"],
  [6.5, "Bom"],
  [5, "Mediano"],
  [0, "Fraco"]
];

export function scoreOf({ rating, membersRating }) {
  const count = membersRating?.count ?? 0;
  const average = membersRating?.average ?? 0;
  return round1((rating * PRIOR_WEIGHT + average * count) / (PRIOR_WEIGHT + count));
}

export function labelOf(score) {
  return LABELS.find(([min]) => score >= min)[1];
}

export function computeInsights(movies, now) {
  if (!Array.isArray(movies)) {
    throw new ValidationError('O corpo deve conter "movies": uma lista de filmes.');
  }
  const valid = movies.map(validateMovie);
  const classified = valid.map((movie) => {
    const score = scoreOf(movie);
    return { movieId: movie.id, title: movie.title, genre: movie.genre, score, label: labelOf(score) };
  });

  const totalReviews = valid.reduce((sum, m) => sum + (m.membersRating?.count ?? 0), 0);
  const membersSum = valid.reduce((sum, m) => sum + (m.membersRating?.average ?? 0) * (m.membersRating?.count ?? 0), 0);

  const genres = new Map();
  for (const item of classified) {
    genres.set(item.genre, [...(genres.get(item.genre) ?? []), item.score]);
  }

  return {
    generatedAt: now.toISOString(),
    totalMovies: valid.length,
    totalReviews,
    averageCriticsRating: valid.length ? round1(valid.reduce((s, m) => s + m.rating, 0) / valid.length) : null,
    averageMembersRating: totalReviews ? round1(membersSum / totalReviews) : null,
    topRated: [...classified].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR")).slice(0, 3),
    byGenre: [...genres.entries()]
      .map(([genre, scores]) => ({ genre, movies: scores.length, averageScore: round1(scores.reduce((a, b) => a + b, 0) / scores.length) }))
      .sort((a, b) => b.averageScore - a.averageScore),
    classifications: classified
  };
}

function validateMovie(movie) {
  if (!movie || typeof movie.id !== "string" || typeof movie.title !== "string" || typeof movie.genre !== "string") {
    throw new ValidationError("Cada filme precisa de id, title e genre.");
  }
  if (typeof movie.rating !== "number" || movie.rating < 0 || movie.rating > 10) {
    throw new ValidationError(`Filme ${movie.id}: rating deve estar entre 0 e 10.`);
  }
  const count = movie.membersRating?.count ?? 0;
  if (!Number.isInteger(count) || count < 0) {
    throw new ValidationError(`Filme ${movie.id}: membersRating.count inválido.`);
  }
  return movie;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}
