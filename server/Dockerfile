# 使用 Ubuntu 作为基础镜像
FROM ubuntu:22.04

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_VERSION=20.x
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Shanghai
ENV NODE_ENV=production

# 安装必要的系统依赖
RUN apt-get update && \
    apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# 安装 Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装依赖（包括开发依赖，因为需要构建）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 清理开发依赖和缓存
RUN pnpm prune --prod && \
    pnpm store prune && \
    npm cache clean --force

# 创建非 root 用户
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 8888

# 启动应用
CMD ["node", "dist/main.js"]

