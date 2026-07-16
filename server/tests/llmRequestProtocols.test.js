const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { z } = require("zod");
const { createOpenAIProtocolClient } = require("../dist/llm/protocols/OpenAIProtocolClient.js");
const {
  getAutomaticProtocolCandidates,
  normalizeModelRequestProtocol,
  resolveEffectiveModelRequestProtocol,
} = require("../dist/llm/protocols/requestProtocol.js");
const {
  resolveLLMClientOptions,
  setProviderSecretCache,
} = require("../dist/llm/factory.js");
const { extractLlmTokenUsage } = require("../dist/llm/usageTracking.js");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function readJsonRequest(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function buildResponsesPayload(text, model, status = "completed") {
  return {
    id: "resp_contract_test",
    object: "response",
    created_at: 1_700_000_000,
    status,
    background: false,
    billing: { payer: "developer" },
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: 64,
    max_tool_calls: null,
    model,
    output: status === "completed" ? [{
      id: "msg_contract_test",
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{
        type: "output_text",
        text,
        annotations: [],
        logprobs: [],
      }],
    }] : [],
    parallel_tool_calls: true,
    previous_response_id: null,
    prompt_cache_key: null,
    prompt_cache_retention: null,
    reasoning: { effort: null, summary: null },
    safety_identifier: null,
    service_tier: "default",
    store: false,
    temperature: 0.2,
    text: { format: { type: "text" }, verbosity: "medium" },
    tool_choice: "auto",
    tools: [],
    top_logprobs: 0,
    top_p: 1,
    truncation: "disabled",
    usage: status === "completed" ? {
      input_tokens: 11,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 7,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 18,
    } : null,
    user: null,
    metadata: {},
  };
}

function contentToText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content.map((part) => typeof part === "string" ? part : part?.text ?? "").join("");
}

test("request protocol precedence and automatic candidates are deterministic", () => {
  assert.equal(normalizeModelRequestProtocol("openai_responses"), "openai_responses");
  assert.equal(normalizeModelRequestProtocol("unknown"), "auto");
  assert.equal(resolveEffectiveModelRequestProtocol({
    requestProtocol: "auto",
    providerRequestProtocol: "openai_responses",
  }), "openai_responses");
  assert.equal(resolveEffectiveModelRequestProtocol({
    requestProtocol: "openai_compatible",
    providerRequestProtocol: "openai_responses",
  }), "openai_compatible");
  assert.deepEqual(getAutomaticProtocolCandidates({
    provider: "openai",
    preferred: "openai_responses",
  }), ["openai_responses", "openai_compatible", "anthropic"]);
});

test("provider defaults are inherited while an explicit route protocol wins", async () => {
  setProviderSecretCache("openai", {
    key: "test-key",
    model: "gpt-4o-mini",
    baseURL: "http://127.0.0.1:9/v1",
    requestProtocol: "openai_responses",
  });
  try {
    const inherited = await resolveLLMClientOptions("openai", { requestProtocol: "auto" });
    assert.equal(inherited.requestProtocol, "openai_responses");
    const explicit = await resolveLLMClientOptions("openai", {
      requestProtocol: "openai_compatible",
    });
    assert.equal(explicit.requestProtocol, "openai_compatible");
  } finally {
    setProviderSecretCache("openai", null);
  }
});

test("Responses API supports plain, structured, streaming, usage, and store=false", async () => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const body = await readJsonRequest(req);
    requests.push({ url: req.url, authorization: req.headers.authorization, body });
    assert.equal(req.url, "/v1/responses");

    const text = body.text?.format?.type === "json_schema"
      ? JSON.stringify({ status: "ok" })
      : body.stream
        ? "streamed response"
        : "plain response";
    if (body.stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });
      const events = [
        {
          type: "response.created",
          sequence_number: 0,
          response: buildResponsesPayload("", body.model, "in_progress"),
        },
        {
          type: "response.output_item.added",
          sequence_number: 1,
          output_index: 0,
          item: {
            id: "msg_contract_test",
            type: "message",
            status: "in_progress",
            role: "assistant",
            content: [],
          },
        },
        {
          type: "response.output_text.delta",
          sequence_number: 2,
          item_id: "msg_contract_test",
          output_index: 0,
          content_index: 0,
          delta: text,
          logprobs: [],
        },
        {
          type: "response.completed",
          sequence_number: 3,
          response: buildResponsesPayload(text, body.model),
        },
      ];
      for (const event of events) {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(buildResponsesPayload(text, body.model)));
  });
  const port = await listen(server);

  try {
    const llm = createOpenAIProtocolClient({
      apiKey: "responses-key",
      model: "gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 64,
      configuration: { baseURL: `http://127.0.0.1:${port}/v1` },
    }, "openai_responses");

    const plain = await llm.invoke("hello");
    assert.equal(contentToText(plain.content), "plain response");
    assert.deepEqual(extractLlmTokenUsage(plain), {
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
    });

    const structured = await llm.withStructuredOutput(
      z.object({ status: z.literal("ok") }),
      { name: "connectivity_probe", method: "jsonSchema", strict: true },
    ).invoke("return JSON");
    assert.deepEqual(structured, { status: "ok" });

    let streamed = "";
    for await (const chunk of await llm.stream("stream this")) {
      streamed += contentToText(chunk.content);
    }
    assert.equal(streamed, "streamed response");

    assert.equal(requests.length, 3);
    assert.ok(requests.every((request) => request.authorization === "Bearer responses-key"));
    assert.ok(requests.every((request) => request.body.store === false));
    assert.ok(requests.every((request) => request.body.max_output_tokens === 64));
    assert.equal(requests[1].body.text.format.type, "json_schema");
    assert.equal(requests[2].body.stream, true);
  } finally {
    await close(server);
  }
});

test("explicit Chat Completions never switches to Responses for a preferred model", async () => {
  const paths = [];
  const server = http.createServer(async (req, res) => {
    const body = await readJsonRequest(req);
    paths.push(req.url);
    assert.equal(req.url, "/v1/chat/completions");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      id: "chatcmpl_contract_test",
      object: "chat.completion",
      created: 1_700_000_000,
      model: body.model,
      choices: [{
        index: 0,
        message: { role: "assistant", content: "chat response" },
        finish_reason: "stop",
        logprobs: null,
      }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    }));
  });
  const port = await listen(server);
  try {
    const llm = createOpenAIProtocolClient({
      apiKey: "chat-key",
      model: "gpt-5-codex",
      configuration: { baseURL: `http://127.0.0.1:${port}/v1` },
    }, "openai_compatible");
    const response = await llm.invoke("stay on chat completions");
    assert.equal(contentToText(response.content), "chat response");
    assert.deepEqual(paths, ["/v1/chat/completions"]);
  } finally {
    await close(server);
  }
});
