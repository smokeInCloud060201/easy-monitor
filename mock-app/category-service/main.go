package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	otellog "go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

var tracer = otel.Tracer("category-service")
var logger *slog.Logger

type Category struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Stock      int    `json:"stock"`
	PriceRange string `json:"price_range"`
	Products   int    `json:"product_count"`
}

var categories = map[string]Category{
	"electronics": {ID: "electronics", Name: "Premium Electronics", Stock: 150, PriceRange: "$50-$2000"},
	"clothing":    {ID: "clothing", Name: "Designer Clothing", Stock: 320, PriceRange: "$20-$500"},
	"books":       {ID: "books", Name: "Books & Media", Stock: 890, PriceRange: "$5-$100"},
	"home":        {ID: "home", Name: "Home & Garden", Stock: 210, PriceRange: "$10-$800"},
	"sports":      {ID: "sports", Name: "Sports & Outdoors", Stock: 175, PriceRange: "$15-$600"},
}

func main() {
	ctx := context.Background()
	tp, lp, err := initTelemetry(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to init telemetry: %v\n", err)
		os.Exit(1)
	}
	defer tp.Shutdown(ctx)
	defer lp.Shutdown(ctx)

	// Create OTel-bridged slog logger
	logger = otelslog.NewLogger("category-service")

	mux := http.NewServeMux()
	mux.HandleFunc("/api/category/", handleGetCategory)
	mux.HandleFunc("/api/category/search", handleSearch)
	mux.HandleFunc("/api/health", handleHealth)

	handler := otelhttp.NewHandler(mux, "category-service")
	logger.Info("Category Service (Go) running on :8081")
	fmt.Println("Category Service (Go) running on :8081")
	if err := http.ListenAndServe(":8081", handler); err != nil {
		logger.Error("Server failed", "error", err)
	}
}

func initTelemetry(ctx context.Context) (*sdktrace.TracerProvider, *sdklog.LoggerProvider, error) {
	res, _ := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String("category-service"),
		),
	)

	// Trace exporter
	traceExporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint("localhost:4317"),
	)
	if err != nil {
		return nil, nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Log exporter
	logExporter, err := otlploggrpc.New(ctx,
		otlploggrpc.WithInsecure(),
		otlploggrpc.WithEndpoint("localhost:4317"),
	)
	if err != nil {
		return nil, nil, err
	}

	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExporter)),
		sdklog.WithResource(res),
	)
	otellog.SetLoggerProvider(lp)

	return tp, lp, nil
}

func handleGetCategory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/category/"), "/")
	categoryID := parts[0]
	if categoryID == "" || categoryID == "search" {
		return
	}

	start := time.Now()
	logger.InfoContext(ctx, "Request started",
		"method", "GET",
		"endpoint", "/api/category/"+categoryID,
		"category_id", categoryID,
	)

	// Step 1: Cache lookup
	cacheHit := simulateCacheSpan(ctx, "GET", "category:"+categoryID)

	cat, exists := categories[categoryID]
	if !exists {
		cat = categories["electronics"]
		logger.WarnContext(ctx, "Category not found, using fallback",
			"requested", categoryID,
			"fallback", "electronics",
		)
	}

	if !cacheHit {
		// Step 2: DB lookup on cache miss
		simulateDbSpan(ctx, "SELECT", "categories",
			fmt.Sprintf("SELECT * FROM categories WHERE id = '%s'", categoryID), 15, 60)

		// Step 3: Warm cache
		simulateCacheSpan(ctx, "SET", "category:"+categoryID)
	}

	// Step 4: Load related products
	simulateDbSpan(ctx, "SELECT", "products",
		fmt.Sprintf("SELECT id, name, price FROM products WHERE category_id = '%s' LIMIT 10", categoryID), 20, 70)

	cat.Products = rand.Intn(50) + 10

	// 5% stock unavailable error
	if rand.Float64() < 0.05 {
		logger.ErrorContext(ctx, "Stock unavailable",
			"category_id", categoryID,
			"status", 409,
			"duration_ms", time.Since(start).Milliseconds(),
		)
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "Stock unavailable", "category": categoryID})
		return
	}

	logger.InfoContext(ctx, "Request completed",
		"method", "GET",
		"endpoint", "/api/category/"+categoryID,
		"status", 200,
		"products", cat.Products,
		"cache_hit", cacheHit,
		"duration_ms", time.Since(start).Milliseconds(),
	)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cat)
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query().Get("q")
	start := time.Now()
	logger.InfoContext(ctx, "Search started",
		"method", "GET",
		"endpoint", "/api/category/search",
		"query", q,
	)

	// Parse search query
	_, span := tracer.Start(ctx, "parse_search_query")
	time.Sleep(time.Duration(2+rand.Intn(6)) * time.Millisecond)
	span.End()

	// DB full-text search
	simulateDbSpan(ctx, "SELECT", "categories",
		"SELECT * FROM categories WHERE name ILIKE '%' || $1 || '%' ORDER BY relevance DESC LIMIT 20", 30, 100)

	result := make([]Category, 0)
	for _, c := range categories {
		result = append(result, c)
	}

	logger.InfoContext(ctx, "Search completed",
		"method", "GET",
		"endpoint", "/api/category/search",
		"query", q,
		"results", len(result),
		"duration_ms", time.Since(start).Milliseconds(),
	)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"results": result, "total": len(result)})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "category-service"})
}

func simulateDbSpan(ctx context.Context, op, table, statement string, minMs, maxMs int) {
	_, span := tracer.Start(ctx, fmt.Sprintf("db.query %s %s", op, table))
	defer span.End()

	span.SetAttributes(
		attribute.String("db.system", "postgresql"),
		attribute.String("db.operation", op),
		attribute.String("db.sql.table", table),
		attribute.String("db.statement", statement),
	)

	duration := time.Duration(minMs+rand.Intn(maxMs-minMs+1)) * time.Millisecond
	time.Sleep(duration)

	// 2% error rate
	if rand.Float64() < 0.02 {
		logger.ErrorContext(ctx, "Database connection timeout",
			"db.operation", op,
			"db.table", table,
			"duration_ms", duration.Milliseconds(),
		)
		span.SetStatus(codes.Error, "connection timeout")
		span.RecordError(fmt.Errorf("DB connection timeout after %v", duration))
	} else {
		span.SetStatus(codes.Ok, "")
	}
}

func simulateCacheSpan(ctx context.Context, op, key string) bool {
	_, span := tracer.Start(ctx, fmt.Sprintf("cache.%s %s", op, key))
	defer span.End()

	hit := rand.Float64() < 0.7
	span.SetAttributes(
		attribute.String("cache.system", "redis"),
		attribute.String("cache.operation", op),
		attribute.String("cache.key", key),
		attribute.Bool("cache.hit", hit),
	)

	if hit {
		time.Sleep(time.Duration(1+rand.Intn(5)) * time.Millisecond)
	} else {
		time.Sleep(time.Duration(2+rand.Intn(8)) * time.Millisecond)
	}
	span.SetStatus(codes.Ok, "")
	return hit
}
