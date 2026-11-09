// Testes de arquitetura com ArchUnitTS.
// Camadas: src/domain, src/application, src/infrastructure, src/api.
// Slices: cada pasta em src/features é uma funcionalidade (caso de uso + gatilho).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { extractGraph, projectFiles } from "archunit";
import { TSCONFIG, escapeRegExp, expectNoViolations, listSlices } from "./archunit.helpers.js";

const files = () => projectFiles(TSCONFIG);

const FEATURES = "src/features";
const DOMAIN = /^src\/(domain|shared\/kernel)\//;
const OUTSIDE_DOMAIN = /^src\/(?!(domain|shared\/kernel)\/)/;
const APPLICATION = /^src\/application\//;
const OUTSIDE_DOMAIN_AND_APPLICATION = /^src\/(?!(domain|application|shared\/kernel)\/)/;
const INFRASTRUCTURE = /^src\/infrastructure\//;
const API = /^src\/api\//;
const COMPOSITION = /^src\/(container|index)\.js$/;
const USE_CASE = /UseCase\.js$/;
const TRIGGER = /\.function\.js$/;

const importsPackage = (name) => new RegExp(`from\\s+["']${escapeRegExp(name)}["']`);

describe("Clean Architecture — regra da dependência", () => {
  test("Domain não depende de nenhuma outra camada", async () => {
    await expectNoViolations(files().inPath(DOMAIN).shouldNot().dependOnFiles().inPath(OUTSIDE_DOMAIN));
  });

  test("Application (portas) depende só do Domain", async () => {
    await expectNoViolations(files().inPath(APPLICATION).shouldNot().dependOnFiles().inPath(OUTSIDE_DOMAIN_AND_APPLICATION));
  });

  test("casos de uso dependem só de Domain e Application (portas)", async () => {
    const forbidden = new RegExp(OUTSIDE_DOMAIN_AND_APPLICATION.source + String.raw`(?!.*UseCase\.js$)`);
    await expectNoViolations(files().withName(USE_CASE).shouldNot().dependOnFiles().inPath(forbidden));
  });

  test("casos de uso importam ao menos uma porta (dependem da abstração)", async () => {
    await expectNoViolations(
      files()
        .withName(USE_CASE)
        .should()
        .adhereTo((file) => /from\s+["'][^"']*\/application\/ports\//.test(file.content), "caso de uso deve importar uma porta")
    );
  });

  test("gatilhos não dependem de Infrastructure nem da composição", async () => {
    await expectNoViolations(files().withName(TRIGGER).shouldNot().dependOnFiles().inPath(INFRASTRUCTURE));
    await expectNoViolations(files().withName(TRIGGER).shouldNot().dependOnFiles().inPath(COMPOSITION));
  });

  test("API não depende de Infrastructure, das slices nem da composição", async () => {
    await expectNoViolations(files().inPath(API).shouldNot().dependOnFiles().inPath(INFRASTRUCTURE));
    await expectNoViolations(files().inPath(API).shouldNot().dependOnFiles().inFolder(`${FEATURES}/**`));
    await expectNoViolations(files().inPath(API).shouldNot().dependOnFiles().inPath(COMPOSITION));
  });

  test("Infrastructure não depende de API, slices nem composição", async () => {
    await expectNoViolations(files().inPath(INFRASTRUCTURE).shouldNot().dependOnFiles().inPath(API));
    await expectNoViolations(files().inPath(INFRASTRUCTURE).shouldNot().dependOnFiles().inFolder(`${FEATURES}/**`));
    await expectNoViolations(files().inPath(INFRASTRUCTURE).shouldNot().dependOnFiles().inPath(COMPOSITION));
  });
});

describe("Vertical Slice — uma pasta por funcionalidade", () => {
  const slices = listSlices(FEATURES);

  test("as slices esperadas existem", () => {
    assert.deepEqual(slices.sort(), ["calculate-insights", "sync-members-rating"]);
  });

  for (const slice of slices) {
    test(`slice "${slice}" não importa outra slice`, async () => {
      const otherSlices = new RegExp(`^${escapeRegExp(FEATURES)}/(?!${escapeRegExp(slice)}/)`);
      await expectNoViolations(files().inFolder(`${FEATURES}/${slice}/**`).shouldNot().dependOnFiles().inPath(otherSlices));
    });
  }

  test("cada slice tem exatamente um caso de uso e um gatilho", async () => {
    await expectNoViolations(files().inFolder(`${FEATURES}/**`).should().haveName(/^([A-Z]\w*UseCase|[a-z]\w*\.function)\.js$/));
    const sources = (await extractGraph(TSCONFIG)).map((edge) => edge.source);
    for (const slice of slices) {
      const sliceFiles = [...new Set(sources.filter((source) => source.includes(`${FEATURES}/${slice}/`)))];
      assert.equal(sliceFiles.filter((f) => USE_CASE.test(f)).length, 1, `${slice}: caso de uso`);
      assert.equal(sliceFiles.filter((f) => TRIGGER.test(f)).length, 1, `${slice}: gatilho`);
    }
  });
});

describe("Frameworks e drivers ficam nas bordas", () => {
  test("só src/index.js importa o SDK @azure/functions", async () => {
    await expectNoViolations(
      files()
        .inFolder("src/**")
        .should()
        .adhereTo((file) => !importsPackage("@azure/functions").test(file.content) || file.path.endsWith("src/index.js"), "@azure/functions só em src/index.js")
    );
  });

  test("só a Infrastructure faz chamadas HTTP (fetch)", async () => {
    await expectNoViolations(
      files()
        .inFolder("src/**")
        .should()
        .adhereTo((file) => !/\bfetch\(/.test(file.content) || /src\/infrastructure\/http\//.test(file.path), "fetch só em infrastructure/http")
    );
  });

  test("só a composição lê variáveis de ambiente", async () => {
    await expectNoViolations(
      files()
        .inFolder("src/**")
        .should()
        .adhereTo((file) => !/process\.env/.test(file.content) || file.path.endsWith("src/index.js"), "process.env só em src/index.js")
    );
  });

  test("Domain e casos de uso não fazem I/O", async () => {
    const noIo = (file) => !/\b(process\.env|fetch\(|console\.)/.test(file.content);
    await expectNoViolations(files().inPath(DOMAIN).should().adhereTo(noIo, "domínio deve ser puro"));
    await expectNoViolations(files().withName(USE_CASE).should().adhereTo(noIo, "caso de uso não faz I/O direto"));
  });

  test("clientes HTTP seguem a convenção Http<Serviço>Api e implementam uma porta", async () => {
    await expectNoViolations(files().inFolder("src/infrastructure/http/**").should().haveName(/^(Http[A-Z]\w*Api|fetchJson)\.js$/));
  });
});

describe("Saúde do grafo de dependências", () => {
  test("não há dependências cíclicas", async () => {
    await expectNoViolations(files().inFolder("src/**").should().haveNoCycles());
  });

  test("o ArchUnitTS leu os imports do projeto", async () => {
    const edges = (await extractGraph(TSCONFIG)).filter((edge) => edge.source !== edge.target && !edge.external);
    assert.ok(edges.length >= 15, `poucas dependências extraídas: ${edges.length}`);
    assert.ok(
      edges.some((edge) => edge.source.endsWith("SyncMembersRatingUseCase.js") && edge.target.endsWith("application/ports/MoviesApi.js")),
      "dependência SyncMembersRatingUseCase -> MoviesApi não encontrada"
    );
  });
});
