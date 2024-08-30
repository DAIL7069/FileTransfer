# 使用官方 Node.js 作为基础镜像
FROM node:22

# 声明构建时变量
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# 设置代理环境变量
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}

# 设置工作目录
WORKDIR /usr/src/app

# 安装 pnpm
RUN npm install -g pnpm

# 复制应用代码到工作目录
COPY . .

# 安装依赖
RUN pnpm install --frozen-lockfile

# 暴露应用运行的端口
EXPOSE 3000

# 启动应用
CMD [ "npm", "run", "deploy:websocket"]
