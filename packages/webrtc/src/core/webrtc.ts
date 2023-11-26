import { SOCKET_EVENT_ENUM, SocketEventParams } from "../types/signaling";
import { SignalingServer } from "./signaling";
import { WebRTCOptions } from "../types/webrtc";

export class WebRTC {
  public readonly id: string;
  private sdp: string | null = null;
  private readonly connection: RTCPeerConnection;
  private readonly channel: RTCDataChannel;
  private readonly signaling: SignalingServer;
  constructor(options: WebRTCOptions) {
    const connection = new RTCPeerConnection({
      iceServers: options.ice
        ? [{ urls: options.ice }]
        : [
            // 开放的`stun`服务器
            { urls: "stun:stun.counterpath.net:3478" },
            { urls: "stun:stun.stunprotocol.org" },
            { urls: "stun:stun.l.google.com:19302" },
          ],
    });
    this.id = options.id;
    this.signaling = options.signaling;
    console.log("Client WebRTC ID:", this.id);
    this.signaling.socket.on(SOCKET_EVENT_ENUM.FORWARD_OFFER, this.onReceiveOffer);
    this.signaling.socket.on(SOCKET_EVENT_ENUM.FORWARD_ANSWER, this.onReceiveAnswer);
    const channel = connection.createDataChannel("FileTransfer", {
      ordered: true, // 保证传输顺序
      maxRetransmits: 50, // 最大重传次数
      negotiated: true, // 双向通信 // 不需要等待`offer`端的`ondatachannel`事件
      id: 777, // 通道`id`
    });
    this.channel = channel;
    this.connection = connection;
  }

  public createRemoteConnection = async (target: string) => {
    console.log("Send Offer To:", target);
    if (this.sdp) {
      const payload = { origin: this.id, sdp: this.sdp, target };
      this.signaling.socket.emit(SOCKET_EVENT_ENUM.SEND_OFFER, payload);
      return void 0;
    }
    this.connection.onicecandidate = async event => {
      if (event.candidate) {
        this.sdp = JSON.stringify(this.connection.localDescription);
        if (this.sdp) {
          const payload = { origin: this.id, sdp: this.sdp, target };
          this.signaling.socket.emit(SOCKET_EVENT_ENUM.SEND_OFFER, payload);
        }
      }
    };
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
  };

  private onReceiveOffer = async (params: SocketEventParams["FORWARD_OFFER"]) => {
    const { sdp, origin } = params;
    console.log("Receive Offer From:", origin);
    const offer = JSON.parse(sdp);
    this.connection.onicecandidate = async event => {
      if (event.candidate) {
        this.signaling.socket.emit(SOCKET_EVENT_ENUM.SEND_ANSWER, {
          origin: this.id,
          sdp: JSON.stringify(this.connection.localDescription),
          target: origin,
        });
      }
    };
    await this.connection.setRemoteDescription(offer);
    const answer = await this.connection.createAnswer();
    await this.connection.setLocalDescription(answer);
  };

  private onReceiveAnswer = async (params: SocketEventParams["FORWARD_ANSWER"]) => {
    const { sdp, origin } = params;
    console.log("Receive Answer From:", origin);
    const answer = JSON.parse(sdp);
    if (!this.connection.currentRemoteDescription) {
      this.connection.setRemoteDescription(answer);
    }
  };

  public onOpen = (callback: (this: RTCDataChannel, event: Event) => void) => {
    this.channel.onopen = callback;
  };

  public onMessage = (callback: (this: RTCDataChannel, event: MessageEvent) => void) => {
    this.channel.onmessage = callback;
  };

  public onError = (callback: (this: RTCDataChannel, event: Event) => void) => {
    this.channel.onerror = callback;
  };

  public onClose = (callback: (this: RTCDataChannel, event: Event) => void) => {
    this.channel.onclose = callback;
  };

  public destroy = () => {
    this.signaling.socket.off(SOCKET_EVENT_ENUM.FORWARD_OFFER, this.onReceiveOffer);
    this.signaling.socket.off(SOCKET_EVENT_ENUM.FORWARD_ANSWER, this.onReceiveAnswer);
    this.channel.close();
    this.connection.close();
    this.signaling.destroy();
  };
}

// Reference
// https://developer.mozilla.org/zh-CN/docs/Web/API/RTCPeerConnection/createDataChannel
// https://developer.mozilla.org/zh-CN/docs/Web/API/WebRTC_API/Simple_RTCDataChannel_sample
