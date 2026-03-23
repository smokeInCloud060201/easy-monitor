package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

var tracer = otel.Tracer("category-service")

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
	tp, err := initTracer(ctx)
	if err != nil {
		log.Fatalf("Failed to init tracer: %v", err)
	}
	defer tp.Shutdown(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/category/", handleGetCategory)
	mux.HandleFunc("/api/category/search", handleSearch)
	mux.HandleFunc("/api/health", handleHealth)

	handler := otelhttp.NewHandler(mux, "category-service")
	log.Println("Category Service (Go) running on :8081")
	log.Fatal(http.ListenAndServe(":8081", handler))
}

func initTracer(ctx context.Context) (*sdktrace.TracerProvider, error) {
	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint("localhost:4317"),
	)
	if err != nil {
		return nil, err
	}

	res, _ := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String("category-service"),
		),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	return tp, nil
}

func handleGetCategory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/category/"), "/")
	categoryID := parts[0]
	if categoryID == "" || categoryID == "search" {
		return
	}

	start := time.Now()
	log.Printf("[INFO] GET /api/category/%s - started", categoryID)

	// Step 1: Cache lookup
	cacheHit := simulateCacheSpan(ctx, "GET", "category:"+categoryID)

	cat, exists := categories[categoryID]
	if !exists {
		cat = categories["electronics"]
		log.Printf("[WARN] Category '%s' not found, using fallback 'electronics'", categoryID)
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
		log.Printf("[ERROR] GET /api/category/%s - stock unavailable (409) took=%s", categoryID, time.Since(start))
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "Stock unavailable", "category": categoryID})
		return
	}

	log.Printf("[INFO] GET /api/category/%s - 200 OK products=%d took=%s", categoryID, cat.Products, time.Since(start))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cat)
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query().Get("q")
	start := time.Now()
	log.Printf("[INFO] GET /api/category/search?q=%s - started", q)

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

	log.Printf("[INFO] GET /api/category/search?q=%s - 200 OK results=%d took=%s", q, len(result), time.Since(start))
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
		log.Printf("[ERROR] DB %s %s - connection timeout after %v", op, table, duration)
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
		log.Printf("[DEBUG] Cache %s %s - HIT", op, key)
	} else {
		time.Sleep(time.Duration(2+rand.Intn(8)) * time.Millisecond)
		log.Printf("[DEBUG] Cache %s %s - MISS", op, key)
	}
	span.SetStatus(codes.Ok, "")
	return hit
}
