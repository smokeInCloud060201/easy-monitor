package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"

	"github.com/easymonitor/agents/go"
	"github.com/easymonitor/category-service/internal/controller"
	"github.com/easymonitor/category-service/internal/domain"
	"github.com/easymonitor/category-service/internal/repository"
	"github.com/easymonitor/category-service/internal/service"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	ctx := context.Background()
	
    tpShutdown, lpShutdown, err := telemetry.Init("category-service")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to init telemetry: %v\n", err)
		os.Exit(1)
	}
	defer tpShutdown(ctx)
	defer lpShutdown(ctx)

	// Dependency Injection: Databases
	dbDsn := "host=localhost user=easymonitor password=password dbname=easymonitor port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dbDsn), &gorm.Config{})
	if err != nil {
		slog.Error("Failed to connect to database", "err", err)
	} else {
		db.AutoMigrate(&domain.Category{})
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	// Dependency Injection: DDD Layers
	repo := repository.NewCategoryRepository(db)
	repo.InitDefaults(ctx) // Seed missing defaults
	svc := service.NewCategoryService(repo, rdb)
	ctrl := controller.NewCategoryController(svc)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/category/", ctrl.HandleGetCategory)
	mux.HandleFunc("/api/category/search", ctrl.HandleSearch)
	mux.HandleFunc("/api/health", ctrl.HandleHealth)

	handler := telemetry.WrapHTTPHandler(mux, "category-service")
    
	slog.Info("Category Service (Go DDD) running on :8081")
	if err := http.ListenAndServe(":8081", handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
