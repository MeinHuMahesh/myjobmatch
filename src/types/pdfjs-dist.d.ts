declare module "pdfjs-dist/build/pdf.mjs" {
  interface TextItem {
    str: string;
  }

  interface TextContent {
    items: Array<TextItem | Record<string, unknown>>;
  }

  interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
  }

  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    destroy(): Promise<void>;
  }

  export const GlobalWorkerOptions: { workerSrc: string };

  export function getDocument(params: { data: Uint8Array }): {
    promise: Promise<PDFDocumentProxy>;
  };
}
