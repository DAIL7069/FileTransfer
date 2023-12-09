export type Member = { id: string; device: DEVICE_TYPE };
export enum CONNECTION_STATE {
  "INIT",
  "READY",
  "CONNECTING",
  "CONNECTED",
}
export enum DEVICE_TYPE {
  "MOBILE",
  "PC",
}

export type ChunkType = Blob | ArrayBuffer;
export type SocketMessageType =
  | { type: "text"; data: string }
  | { type: "file-start"; size: number; name: string; id: string; total: number }
  | { type: "file-next"; id: string; offset: number }
  | { type: "file-chunk"; id: string; base64: string }
  | { type: "file-finish"; id: string };
export type TransferListItem =
  | { type: "text"; data: string; from: "self" | "peer" }
  | {
      type: "file";
      size: number;
      name: string;
      progress: number;
      id: string;
      from: "self" | "peer";
    };
