const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { HumanMessage } = require("@langchain/core/messages");
const {
  createOpenAIProtocolClient,
} = require("../dist/llm/protocols/OpenAIProtocolClient.js");
const {
  normalizeResponsesApiResponse,
} = require("../dist/llm/protocols/responsesCompatibility.js");

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

function writeEvent(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

test("normalizes missing output and annotations in non-stream Responses payloads", () => {
  const normalized = normalizeResponsesApiResponse({
    id: "resp_non_stream",
    status: "completed",
    output_text: "ok",
  });

  assert.equal(normalized.output[0].content[0].text, "ok");
  assert.deepEqual(normalized.output[0].content[0].annotations, []);

  const existingOutput = normalizeResponsesApiResponse({
    id: "resp_annotations",
    status: "completed",
    output: [{
      id: "msg_annotations",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: "ok" }],
    }],
  });
  assert.deepEqual(existingOutput.output[0].content[0].annotations, []);

  const toolOnlyOutput = normalizeResponsesApiResponse({
    id: "resp_tool_only",
    status: "completed",
    output_text: "fallback text",
    output: [{ type: "function_call", name: "lookup", arguments: "{}" }],
  });
  assert.equal(toolOnlyOutput.output[1].content[0].text, "fallback text");
});

test("Responses streaming tolerates a completed event without output", async () => {
  const server = http.createServer(async (req, res) => {
    assert.equal(req.url, "/v1/responses");
    for await (const _chunk of req) {
      // Drain the request before writing the stream.
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    writeEvent(res, {
      type: "response.created",
      response: {
        id: "resp_compat_stream",
        object: "response",
        status: "in_progress",
        model: "gpt-5-mini",
      },
    });
    writeEvent(res, {
      type: "response.output_item.added",
      output_index: 0,
      item: {
        id: "msg_compat_stream",
        type: "message",
        status: "in_progress",
        role: "assistant",
        content: [],
      },
    });
    writeEvent(res, {
      type: "response.output_text.delta",
      output_index: 0,
      content_index: 0,
      delta: "{\"status\":\"ok\"}",
    });
    writeEvent(res, {
      type: "response.completed",
      response: {
        id: "resp_compat_stream",
        object: "response",
        status: "completed",
        model: "gpt-5-mini",
        usage: { input_tokens: 4, output_tokens: 5, total_tokens: 9 },
      },
    });
    res.end("data: [DONE]\n\n");
  });
  const port = await listen(server);

  try {
    const llm = createOpenAIProtocolClient({
      apiKey: "test-key",
      model: "gpt-5-mini",
      maxTokens: 32,
      configuration: { baseURL: `http://127.0.0.1:${port}/v1` },
    }, "openai_responses");
    let text = "";
    for await (const chunk of await llm.stream([new HumanMessage("return json")])) {
      text += typeof chunk.content === "string"
        ? chunk.content
        : chunk.content.map((part) => part.text ?? "").join("");
    }
    assert.equal(text, "{\"status\":\"ok\"}");
  } finally {
    await close(server);
  }
});

test("Chat Completions remains bound to the chat endpoint", async () => {
  const server = http.createServer(async (req, res) => {
    assert.equal(req.url, "/v1/chat/completions");
    for await (const _chunk of req) {
      // Drain the request before writing the response.
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      id: "chatcmpl_compat",
      object: "chat.completion",
      created: 1,
      model: "gpt-5-mini",
      choices: [{
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: "chat-ok" },
      }],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
    }));
  });
  const port = await listen(server);

  try {
    const llm = createOpenAIProtocolClient({
      apiKey: "test-key",
      model: "gpt-5-mini",
      maxTokens: 32,
      configuration: { baseURL: `http://127.0.0.1:${port}/v1` },
    }, "openai_compatible");
    const result = await llm.invoke([new HumanMessage("return text")]);
    assert.equal(result.content, "chat-ok");
  } finally {
    await close(server);
  }
});
