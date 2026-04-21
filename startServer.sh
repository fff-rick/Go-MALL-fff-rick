#!/bin/bash

echo "===== 启动所有服务 ====="

# 日志目录
mkdir -p logs

# user
echo "启动 user rpc..."
cd service/user/rpc
nohup go run user.go -f etc/user.yaml > ../../../logs/user_rpc.log 2>&1 &

echo "启动 user api..."
cd ../api
nohup go run user.go -f etc/user.yaml > ../../../logs/user_api.log 2>&1 &


# product
echo "启动 product rpc..."
cd ../../product/rpc
nohup go run product.go -f etc/product.yaml > ../../../logs/product_rpc.log 2>&1 &

echo "启动 product api..."
cd ../api
nohup go run product.go -f etc/product.yaml > ../../../logs/product_api.log 2>&1 &


# order
echo "启动 order rpc..."
cd ../../order/rpc
nohup go run order.go -f etc/order.yaml > ../../../logs/order_rpc.log 2>&1 &

echo "启动 order api..."
cd ../api
nohup go run order.go -f etc/order.yaml > ../../../logs/order_api.log 2>&1 &

# pay
echo "启动 pay rpc..."
cd ../../pay/rpc
nohup go run pay.go -f etc/pay.yaml > ../../../logs/pay_rpc.log 2>&1 &

echo "启动 pay api..."
cd ../api
nohup go run pay.go -f etc/pay.yaml > ../../../logs/pay_api.log 2>&1 &


echo "===== 所有服务已后台启动 ====="