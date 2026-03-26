#!/bin/bash
set -e

# ─── Polyglot Microservices Start Script ───
#
# Core SAGA Loop:
#   - order-service (Java 21)        :8080
#   - product-service (Go)           :8081
#   - payment-service (Bun)          :8082
#   - notification-service (Rust)    :8083
#   - user-service (Go)              :8085
#   - inventory-service (Rust)       :8086
#   - shipping-service (Bun)         :8087
#   - cart-service (Java 21)         :8088
#   - pricing-service (Java 21)      :8089

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS=()

cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null

    echo "✅ All services stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Easy Monitor — Polyglot Microservices Mock App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
sleep 5 # give postgres & redis a moment to wake up

# ─── 1. Build Services ───
build_java() {
  echo "📦 Building $1 (Java/Spring Boot)..."
  cd "$SCRIPT_DIR/$1" && ./gradlew bootJar -q 2>&1
  echo "   ✅ $1.jar ready"
}
build_go() {
  echo "📦 Building $1 (Go)..."
  cd "$SCRIPT_DIR/$1" && go build -o $1 . 2>&1
  echo "   ✅ $1 binary ready"
}
build_rust() {
  echo "📦 Building $1 (Rust)..."
  cd "$SCRIPT_DIR/$1" && cargo build -q 2>&1
  echo "   ✅ $1 binary ready"
}
build_bun() {
  echo "📦 Installing $1 deps (Bun)..."
  cd "$SCRIPT_DIR/$1" && bun install --silent 2>&1
  echo "   ✅ $1 deps ready"
}

build_java order-service
build_java cart-service
build_java pricing-service

build_go product-service
build_go user-service

build_rust notification-service
build_rust inventory-service

build_bun payment-service
build_bun shipping-service

echo ""
echo "─── Starting Services ───"

LOG_DIR="$SCRIPT_DIR/.logs"
mkdir -p "$LOG_DIR"

start_java() {
  echo "☕ Starting $1 on :$2..."
  cd "$SCRIPT_DIR/$1"
  OTEL_SERVICE_NAME=$1 \
  java -javaagent:../../agents/java/build/libs/easymonitor-javaagent-all.jar \
       -jar build/libs/$1.jar \
       --server.port=$2 \
       > "$LOG_DIR/${1%-service}.log" 2>&1 &
  PIDS+=($!)
}

start_go() {
  echo "🐹 Starting $1 on :$2..."
  cd "$SCRIPT_DIR/$1"
  OTEL_SERVICE_NAME=$1 \
  ./$1 > "$LOG_DIR/${1%-service}.log" 2>&1 &
  PIDS+=($!)
}

start_bun() {
  echo "🥟 Starting $1 on :$2..."
  cd "$SCRIPT_DIR/$1"
  OTEL_SERVICE_NAME=$1 \
  bun run --preload ../../agents/node/instrumentation.ts src/index.ts > "$LOG_DIR/${1%-service}.log" 2>&1 &
  PIDS+=($!)
}

start_rust() {
  echo "🦀 Starting $1 on :$2..."
  cd "$SCRIPT_DIR/$1"
  OTEL_SERVICE_NAME=$1 \
  ./target/debug/$1 > "$LOG_DIR/${1%-service}.log" 2>&1 &
  PIDS+=($!)
}

start_java order-service 8080
start_go product-service 8081
start_bun payment-service 8082
start_rust notification-service 8083

start_go user-service 8085
start_rust inventory-service 8086
start_bun shipping-service 8087
start_java cart-service 8088
start_java pricing-service 8089

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# ─── 3. Health Checks ───
echo ""
echo "─── Health Checks ───"
SERVICES="order-service:8080 product-service:8081 payment-service:8082 notification-service:8083 user-service:8085 inventory-service:8086 shipping-service:8087 cart-service:8088 pricing-service:8089"

for svc in $SERVICES; do
    name="${svc%%:*}"
    port="${svc##*:}"
    if curl -sf "http://localhost:$port/api/health" > /dev/null 2>&1; then
        echo "   $name (:$port) — healthy"
    else
        echo "   $name (:$port) — not ready yet (may need more time)"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " All services running! Generating traffic..."
echo "  Press Ctrl+C to stop all services."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── 4. Tail Service Logs ───
tail -f "$LOG_DIR"/*.log 2>/dev/null &
PIDS+=($!)
sleep 1

# ─── 5. Traffic Generator ───
ITEMS='[{"id":"electronics","qty":2,"price":49.99},{"id":"clothing","qty":1,"price":89.99}]'

TICK=0
while true; do
    TICK=$((TICK + 1))

    # Full checkout flow
    curl -sf -X POST http://localhost:8080/api/order \
         -H "Content-Type: application/json" \
         -d "{\"items\":$ITEMS}" > /dev/null 2>&1 &

    sleep 1
    
    # Mock External Payment Webhook triggering SAGA PubSub
    curl -sf -X POST http://localhost:8082/api/v1/payments/webhook \
         -H "Content-Type: application/json" \
         -d "{\"paymentId\":\"pay_12345\",\"status\":\"SUCCESS\",\"orderId\":\"ord_$TICK\"}" > /dev/null 2>&1 &

    sleep 1
done
