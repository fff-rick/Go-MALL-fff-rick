#!/bin/bash

echo "===== 停止所有服务 ====="

# 定义端口
ports=(9000 8000 9001 8001 9002 8002 9003 8003)

for port in "${ports[@]}"
do
  pid=$(lsof -ti:$port)

  if [ -n "$pid" ]; then
    echo "停止端口 $port (PID: $pid)"
    kill -9 $pid
  else
    echo "端口 $port 未运行"
  fi
done

echo "===== 停止完成 ====="