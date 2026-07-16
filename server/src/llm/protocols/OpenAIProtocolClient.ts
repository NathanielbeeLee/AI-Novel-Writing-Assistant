import {
  ChatOpenAI,
  ChatOpenAIResponses,
  type ChatOpenAIFields,
  type OpenAIClient,
  type OpenAICoreRequestOptions,
} from "@langchain/openai";
import type { OpenAIRequestProtocol } from "./requestProtocol";
import {
  normalizeResponsesApiResponse,
  normalizeResponsesApiStream,
} from "./responsesCompatibility";

class CompatibleChatOpenAIResponses extends ChatOpenAIResponses {
  override completionWithRetry(
    request: OpenAIClient.Responses.ResponseCreateParamsStreaming,
    requestOptions?: OpenAICoreRequestOptions,
  ): Promise<AsyncIterable<OpenAIClient.Responses.ResponseStreamEvent>>;
  override completionWithRetry(
    request: OpenAIClient.Responses.ResponseCreateParamsNonStreaming,
    requestOptions?: OpenAICoreRequestOptions,
  ): Promise<OpenAIClient.Responses.Response>;
  override async completionWithRetry(
    request:
      | OpenAIClient.Responses.ResponseCreateParamsStreaming
      | OpenAIClient.Responses.ResponseCreateParamsNonStreaming,
    requestOptions?: OpenAICoreRequestOptions,
  ): Promise<
    | AsyncIterable<OpenAIClient.Responses.ResponseStreamEvent>
    | OpenAIClient.Responses.Response
  > {
    if (request.stream) {
      const response = await super.completionWithRetry(request, requestOptions);
      return normalizeResponsesApiStream(
        response,
      ) as AsyncIterable<OpenAIClient.Responses.ResponseStreamEvent>;
    }
    const response = await super.completionWithRetry(request, requestOptions);
    return normalizeResponsesApiResponse(response);
  }
}

class ProtocolBoundChatOpenAI extends ChatOpenAI {
  private readonly boundRequestProtocol: OpenAIRequestProtocol;

  constructor(fields: ChatOpenAIFields, requestProtocol: OpenAIRequestProtocol) {
    const responsesFields = {
      ...fields,
      ...(requestProtocol === "openai_responses" ? { zdrEnabled: true } : {}),
    };
    super({
      ...responsesFields,
      useResponsesApi: requestProtocol === "openai_responses",
      ...(requestProtocol === "openai_responses"
        ? { responses: new CompatibleChatOpenAIResponses(responsesFields) }
        : {}),
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
