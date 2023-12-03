import http from "http";
import express from "express";
import process from "process";
import { Server } from "socket.io";
import {
  CLINT_EVENT,
  SERVER_EVENT,
  ServerHandler,
  ClientHandler,
  SocketEventParams,
} from "../types/signaling";
import { CONNECTION_STATE, Member, ServerSocket } from "../types/server";
import { getIpByRequest, getLocalIp } from "./utils";

const app = express();
app.use(express.static("build/static"));
const httpServer = http.createServer(app);
const io = new Server<ClientHandler, ServerHandler>(httpServer);

const authenticate = new WeakMap<ServerSocket, string>();
const mapper = new Map<string, Member>();
const rooms = new Map<string, string[]>();

io.on("connection", socket => {
  socket.on(CLINT_EVENT.JOIN_ROOM, ({ id, device }) => {
    // 验证
    if (!id) return void 0;
    authenticate.set(socket, id);
    // 加入房间
    const ip = getIpByRequest(socket.request);
    const room = rooms.get(ip) || [];
    rooms.set(ip, [...room, id]);
    mapper.set(id, { socket, device, state: CONNECTION_STATE.NORMAL, ip });
    // 房间通知消息
    const initialization: SocketEventParams["JOINED_MEMBER"]["initialization"] = [];
    room.forEach(key => {
      const instance = mapper.get(key);
      if (!instance) return void 0;
      initialization.push({ id: key, device: instance.device });
      instance.socket.emit(SERVER_EVENT.JOINED_ROOM, { id, device });
    });
    socket.emit(SERVER_EVENT.JOINED_MEMBER, { initialization });
  });

  socket.on(CLINT_EVENT.SEND_OFFER, ({ origin, sdp, target }) => {
    // 验证
    if (authenticate.get(socket) !== origin) return void 0;
    // 转发`Offer`
    const targetSocket = mapper.get(target)?.socket;
    if (targetSocket) {
      targetSocket.emit(SERVER_EVENT.FORWARD_OFFER, { origin, sdp, target });
    }
  });

  socket.on(CLINT_EVENT.SEND_ANSWER, ({ origin, sdp, target }) => {
    // 验证
    if (authenticate.get(socket) !== origin) return void 0;
    // 转发`Answer` // TODO: 记录状态
    const targetSocket = mapper.get(target)?.socket;
    if (targetSocket) {
      targetSocket.emit(SERVER_EVENT.FORWARD_ANSWER, { origin, sdp, target });
    }
  });

  socket.on(CLINT_EVENT.LEAVE_ROOM, ({ id }) => {
    // 验证
    if (authenticate.get(socket) !== id) return void 0;
    // 退出房间
    const instance = mapper.get(id);
    if (!instance) return void 0;
    const room = (rooms.get(instance.ip) || []).filter(key => key !== id);
    if (room.length === 0) {
      rooms.delete(instance.ip);
    } else {
      rooms.set(instance.ip, room);
    }
    mapper.delete(id);
    // 房间内通知
    room.forEach(key => {
      const instance = mapper.get(key);
      if (!instance) return void 0;
      instance.socket.emit(SERVER_EVENT.LEFT_ROOM, { id });
    });
  });

  socket.on("disconnect", () => {
    // 验证
    const id = authenticate.get(socket);
    // 退出房间
    if (id) {
      const instance = mapper.get(id);
      if (!instance) return void 0;
      const room = (rooms.get(instance.ip) || []).filter(key => key !== id);
      if (room.length === 0) {
        rooms.delete(instance.ip);
      } else {
        rooms.set(instance.ip, room);
      }
      mapper.delete(id);
      // 房间内通知
      room.forEach(key => {
        const instance = mapper.get(key);
        if (!instance) return void 0;
        instance.socket.emit(SERVER_EVENT.LEFT_ROOM, { id });
      });
    }
  });
});

process.on("SIGINT", () => {
  console.info("SIGINT Received, exiting...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.info("SIGTERM Received, exiting...");
  process.exit(0);
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  const ip = getLocalIp();
  console.log(`Listening on port http://localhost:${PORT} ...`);
  ip.forEach(item => {
    console.log(`Listening on port http://${item}:${PORT} ...`);
  });
});
