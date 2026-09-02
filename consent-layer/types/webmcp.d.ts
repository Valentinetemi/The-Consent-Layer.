import type { ModelContextLike, WebMcpTool } from "@/lib/webmcp";

declare global {
  interface Document {
    modelContext?: ModelContextLike;
  }

  interface Window {
    __consentLayerTools?: Record<string, WebMcpTool>;
  }
}

export {};
