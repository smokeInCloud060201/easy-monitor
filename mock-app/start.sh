#!/bin/bash
cd "$(dirname "$0")"

echo "Building Java Spring Boot Notification Service..."
cd notification-service
./gradlew clean bootJar -q
cd ..

echo "Starting Notification Service (Java + OTel Agent)..."
java -javaagent:notification-service/opentelemetry-javaagent.jar \
     -Dotel.service.name=notification-service \
     -Dotel.exporter.otlp.endpoint=http://127.0.0.1:4317 \
     -Dotel.exporter.otlp.protocol=grpc \
     -jar notification-service/build/libs/notification-service-0.0.1-SNAPSHOT.jar &
PID_JAVA=$!

echo "Waiting for JVM startup (5s)..."
sleep 5 

OTEL_SERVICE_NAME=category-service node --require ./instrumentation.js category.js &
PID1=$!

OTEL_SERVICE_NAME=payment-service node --require ./instrumentation.js payment.js &
PID2=$!

OTEL_SERVICE_NAME=order-service node --require ./instrumentation.js order.js &
PID3=$!

OTEL_SERVICE_NAME=api-gateway node --require ./instrumentation.js index.js &
PID4=$!

trap "kill $PID_JAVA $PID1 $PID2 $PID3 $PID4 2>/dev/null" EXIT

sleep 2

echo ""
echo "=== Mock App Cluster Started ==="
echo "  api-gateway:          http://localhost:8080"
echo "  category-service:     http://localhost:8081"
echo "  payment-service:      http://localhost:8082"
echo "  order-service:        http://localhost:8083"
echo "  notification-service: http://localhost:8084"
echo ""
echo "Generating varied traffic patterns..."

while true; do
  # Checkout flow via gateway (deep trace: gateway → order → category + payment → notification)
  curl -s -X POST http://localhost:8080/api/checkout \
    -H "Content-Type: application/json" \
    -d '{"items":[{"id":"item_1","qty":2}]}' > /dev/null &

  sleep 0.5

  # Direct order lookup (medium trace: order → cache/db)
  curl -s http://localhost:8083/api/orders/ord_$(date +%s) > /dev/null &

  sleep 0.5

  # User lookup via gateway (medium trace: gateway → auth + cache/db)
  curl -s http://localhost:8080/api/users > /dev/null &

  sleep 0.5

  # Category browse (medium trace: category → cache/db + products query)
  CATS=("electronics" "clothing" "books" "home")
  RANDOM_CAT=${CATS[$RANDOM % ${#CATS[@]}]}
  curl -s http://localhost:8081/api/category/$RANDOM_CAT > /dev/null &

  sleep 0.5

  # Payment status check (light trace: payment → cache/db)
  curl -s http://localhost:8082/api/payment/status/txn_$(date +%s) > /dev/null &

  sleep 1
done
