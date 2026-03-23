package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/easymonitor/agents/go"
)

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
	
    // EasyMonitor GO Agent Initialization completely encapsulating config and span hooking
    tpShutdown, lpShutdown, err := telemetry.Init("category-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to init telemetry: %v\n", err)
		os.Exit(1)
	}
	defer tpShutdown(ctx)
	defer lpShutdown(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/category/", handleGetCategory)
	mux.HandleFunc("/api/category/search", handleSearch)
	mux.HandleFunc("/api/health", handleHealth)

    // Securely delegate HTTP span boundary tracing completely to the centralized agent
	handler := telemetry.WrapHTTPHandler(mux, "category-service")
    
	slog.Info("Category Service (Go) running on :8081")
	if err := http.ListenAndServe(":8081", handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handleGetCategory(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/category/"), "/")
	categoryID := parts[0]
	if categoryID == "" || categoryID == "search" {
		return
	}

	start := time.Now()
	slog.Info(fmt.Sprintf("Request started: GET /api/category/%s", categoryID))

	// Step 1: Cache lookup
	cacheHit := rand.Float64() < 0.7
	if cacheHit {
		time.Sleep(time.Duration(1+rand.Intn(5)) * time.Millisecond)
	} else {
		time.Sleep(time.Duration(2+rand.Intn(8)) * time.Millisecond)
	}

	cat, exists := categories[categoryID]
	if !exists {
		cat = categories["electronics"]
		slog.Warn("Category not found, using fallback electronics")
	}

	if !cacheHit {
		// Step 2: DB lookup on cache miss
		time.Sleep(time.Duration(15+rand.Intn(45)) * time.Millisecond)
		// Step 3: Warm cache
		time.Sleep(time.Duration(2+rand.Intn(8)) * time.Millisecond)
	}

	// Step 4: Load related products
	time.Sleep(time.Duration(20+rand.Intn(50)) * time.Millisecond)
	cat.Products = rand.Intn(50) + 10

	// 5% stock unavailable error
	if rand.Float64() < 0.05 {
		slog.Error(fmt.Sprintf("Stock unavailable for %s", categoryID))
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "Stock unavailable", "category": categoryID})
		return
	}

	slog.Info(fmt.Sprintf("Request completed in %dms - cacheHit: %v", time.Since(start).Milliseconds(), cacheHit))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cat)
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	start := time.Now()
	slog.Info(fmt.Sprintf("Search started: %s", q))

	time.Sleep(time.Duration(2+rand.Intn(6)) * time.Millisecond)

	// DB full-text search
	time.Sleep(time.Duration(30+rand.Intn(70)) * time.Millisecond)

	result := make([]Category, 0)
	for _, c := range categories {
		result = append(result, c)
	}

	slog.Info(fmt.Sprintf("Search completed in %dms", time.Since(start).Milliseconds()))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"results": result, "total": len(result)})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "category-service"})
}
