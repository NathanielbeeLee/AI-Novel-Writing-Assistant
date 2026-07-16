import { ChatOpenAI, type ChatOpenAIFields } from "@langchain/openai";
import type { OpenAIRequestProtocol } from "./requestProtocol";

class ProtocolBoundChatOpenAI extends ChatOpenAI {
  private readonly boundRequestProtocol: OpenAIRequestProtocol;

  constructor(fields: ChatOpenAIFields, requestProtocol: OpenAIRequestProtocol) {
    super({
      ...fields,
      useResponsesApi: requestProtocol === "openai_responses",
      ...(requestProtocol === "openai_responses" ? { zdrEnabled: true } : {}),
    });
    this.boundRequestProtocol = requestProtocol;
  }

  protected override _useResponsesApi(
    _options: this["ParsedCallOptions"] | undefined,
  ): boolean {
    return this.boundRequestProtocol === "openai_responses";
  }
}

export function createOpenAIProtocolClient(
  fields: ChatOpenAIFields,
  requestProtocol: OpenAIRequestProtocol,
): ChatOpenAI {
  return new ProtocolBoundChatOpenAI(fields, requestProtocol);
}
