import { UpstreamError } from "../../application/errors/UpstreamError.js";

/** GET/PATCH JSON com timeout. Devolve { status, body }; lança UpstreamError em falha de rede ou 5xx. */
export async function fetchJson(service, url, { method = "GET", body, timeoutMs = 8000 } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new UpstreamError(service, `falha ao chamar ${url}: ${error.message}`);
  }
  if (response.status >= 500) {
    throw new UpstreamError(service, `${method} ${url} respondeu ${response.status}`);
  }
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
