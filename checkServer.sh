#!/bin/bash

echo "===== 服务状态检查（极速版）====="

# 一次性获取所有监听端口
ports=$(ss -lnt)

check() {
  name=$1
  port=$2

  echo "$ports" | grep -q ":$port " && \
    echo "✅ $name ($port) 运行中" || \
    echo "❌ $name ($port) 未运行"
}

check "user_rpc" 9000
check "user_api" 8000
check "product_rpc" 9001
check "product_api" 8001
check "order_rpc" 9002
check "order_api" 8002
check "pay_rpc" 9003
check "pay_api" 8003

echo "===== 检查完成 ====="