#!/bin/bash
cd "$(dirname "$0")"

mkdir -p /tmp/mock-logs
rm -f /tmp/mock-logs/*.log

OTEL_SERVICE_NAME=category-service node --require ./instrumentation.js category.js > /tmp/mock-logs/category-service.log 2>&1 &
PID1=$!

OTEL_SERVICE_NAME=payment-service node --require ./instrumentation.js payment.js > /tmp/mock-logs/payment-service.log 2>&1 &
PID2=$!

OTEL_SERVICE_NAME=order-service node --require ./instrumentation.js order.js > /tmp/mock-logs/order-service.log 2>&1 &
PID3=$!

trap "kill $PID1 $PID2 $PID3" EXIT

sleep 2

echo "Microservices cluster started successfully! 🔥"
echo "Simulating relentless global customer checkout traffic cascading across 3 different servers..."

while true; do
  curl -s -X POST http://localhost:8083/api/checkout > /dev/null
  sleep 1
done
