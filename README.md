# MovieHub — Azure Function

Azure Function do MovieHub (modelo de programação v4 do Node.js) com dois gatilhos:

| Gatilho | Função | O que faz |
|---|---|---|
| **HTTP** — `POST /api/insights` | `insights` | Recebe os filmes e devolve score, classificação, top 3 e médias por gênero. Chamado pelo BFF no `GET /aggregated-data`. Protegido por chave (`x-functions-key`). |
| **Mensagem** — fila `avaliacoes-eventos` | `syncMembersRating` | Consome os eventos do microsserviço de avaliações, busca a média atual em `GET /movie-stats/{movieId}` e grava em `PATCH /movies/{id}/members-rating` no microsserviço de filmes. |

O score é uma média bayesiana: a nota da crítica pesa como 3 avaliações e, quanto mais membros avaliam, mais o score se aproxima da opinião deles. Classificação: Aclamado (≥ 9), Muito bom (≥ 8), Bom (≥ 6,5), Mediano (≥ 5), Fraco.

O processamento da fila é idempotente: a média é sempre recalculada a partir do microsserviço de avaliações, então reprocessar um evento ou recebê-lo fora de ordem não deixa o dado errado. Falhas de rede ou 5xx fazem o runtime tentar de novo (até 5 vezes, depois a mensagem vai para `avaliacoes-eventos-poison`); eventos inválidos são descartados com log.

## Arquitetura

```
src/
├── domain/               insights.js (cálculo puro), reviewEvents.js (validação do evento)
├── application/          portas MoviesApi, ReviewsApi, Clock; UpstreamError
├── features/
│   ├── calculate-insights/   CalculateInsightsUseCase + calculateInsights.function (gatilho HTTP)
│   └── sync-members-rating/  SyncMembersRatingUseCase + syncMembersRating.function (gatilho de fila)
├── infrastructure/       HttpMoviesApi, HttpReviewsApi (fetch com timeout), SystemClock
├── api/                  respostas HTTP
├── container.js          composition root
└── index.js              registra os gatilhos com @azure/functions (único arquivo que conhece o SDK)
docs/
├── asyncapi.yaml         especificação dos eventos (AsyncAPI 3.0)
└── openapi-insights.yaml especificação do gatilho HTTP
```

## Tecnologias

Node.js 22, Azure Functions v4 (@azure/functions), Azure Queue Storage, CloudEvents 1.0, AsyncAPI 3.0, node:test, ArchUnitTS, GitHub Actions.

## Como executar

Pré-requisitos: [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) e o Azurite (`npx azurite`).

```bash
npm install
cp local.settings.example.json local.settings.json
npx azurite --silent &      # emulador do Storage (fila)
npm start                   # func start — HTTP em http://localhost:7071/api/insights
```

Com os dois microsserviços rodando (portas 3001 e 3002), criar uma avaliação no microsserviço de avaliações faz a Function atualizar a nota dos membros no de filmes.

| App setting | Descrição |
|---|---|
| `MOVIES_SERVICE_URL` | URL do microsserviço de filmes |
| `REVIEWS_SERVICE_URL` | URL do microsserviço de avaliações |
| `EventsStorage` | Connection string do Storage Account da fila |
| `EVENTS_QUEUE_NAME` | Nome da fila (padrão `avaliacoes-eventos`) |
| `INSIGHTS_AUTH_LEVEL` | `function` (padrão, exige chave) ou `anonymous` (só local) |

### Testes

```bash
npm run test:unit   # domínio, casos de uso, clientes HTTP e gatilhos
npm run test:arch   # ArchUnitTS
```

### Deploy

```bash
func azure functionapp publish <nome-do-function-app> --javascript
```

Ou pelo GitHub Actions: defina a variável `AZURE_FUNCTIONAPP_NAME` e o secret `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` no repositório.

### Documentação dos eventos

Abra `docs/asyncapi.yaml` no [AsyncAPI Studio](https://studio.asyncapi.com/) (botão Import → URL do arquivo raw no GitHub).

## Repositórios do MovieHub

| Repositório | Papel |
|---|---|
| `moviehub-frontend` | Microfrontend React (shell + MFE Catálogo + MFE Avaliações) |
| `moviehub-bff` | BFF em Node/Express, único ponto de entrada do frontend (atrás do API Management) |
| `moviehub-ms-filmes` | Microsserviço de filmes — MongoDB Atlas |
| `moviehub-ms-avaliacoes` | Microsserviço de avaliações — Azure SQL, publica eventos na fila |
| `moviehub-function` | Azure Function — gatilho HTTP (insights) e gatilho de fila (eventos de avaliação) |

## Grupo

PJBL de Arquitetura de Soluções com Cloud — PUCPR, prof. Manoel Valerio da Silveira Neto.

- Brayan Calisto dos Santos
- Caio Gabriel Silva
- Juliana Flores de Lima
- Leandro de Freitas Pires
