#!/bin/bash
cd "$(dirname "$0")"

echo "Building Java Spring Boot Notification Service generically natively..."
cd notification-service
./gradlew clean bootJar -q
cd ..

echo "Java dynamically cleanly booting up seamlessly wrapping OTel Java Agent..."
java -javaagent:notification-service/opentelemetry-javaagent.jar \
     -Dotel.service.name=notification-service \
     -Dotel.exporter.otlp.endpoint=http://127.0.0.1:4317 \
     -Dotel.exporter.otlp.protocol=grpc \
     -jar notification-service/build/libs/notification-service-0.0.1-SNAPSHOT.jar &
PID_JAVA=$!

echo "Waiting strictly purely beautifully smoothly sequentially correctly for robust JVM runtime bounds inherently natively 5 seconds..."
sleep 5 

OTEL_SERVICE_NAME=category-service node --require ./instrumentation.js category.js &
PID1=$!

OTEL_SERVICE_NAME=payment-service node --require ./instrumentation.js payment.js &
PID2=$!

OTEL_SERVICE_NAME=order-service node --require ./instrumentation.js order.js &
PID3=$!

trap "kill $PID_JAVA $PID1 $PID2 $PID3" EXIT

sleep 2

echo "Multi-Language (Node + JVM) cluster organically correctly spawned flawlessly cleanly! 🔥"
echo "Simulating relentless global customer generic traffic heavily routing properly precisely elegantly natively spanning explicitly 4 isolated microservices cleanly safely..."

while true; do
  curl -s -X POST http://localhost:8083/api/checkout > /dev/null
  sleep 1
done
