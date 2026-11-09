/** API — respostas HTTP no formato do Azure Functions (HttpResponseInit). */
export const ok = (body) => ({ status: 200, jsonBody: body });
export const badRequest = (message) => ({ status: 400, jsonBody: { error: "ValidationError", message } });
