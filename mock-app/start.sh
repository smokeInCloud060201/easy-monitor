#!/bin/bash
cd "$(dirname "$0")"

OTEL_SERVICE_NAME=category-service node --require ./instrumentation.js category.js &
PID1=$!

OTEL_SERVICE_NAME=payment-service node --require ./instrumentation.js payment.js &
PID2=$!

OTEL_SERVICE_NAME=order-service node --require ./instrumentation.js order.js &
PID3=$!

trap "kill $PID1 $PID2 $PID3" EXIT

sleep 2

echo "Microservices cluster started successfully! 🔥"
echo "Simulating relentless global customer checkout traffic cascading across 3 different servers..."

while true; do
  curl -s -X POST http://localhost:8083/api/checkout > /dev/null
  sleep 1
done
