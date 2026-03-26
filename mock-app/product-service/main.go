package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"

	"github.com/easymonitor/agents/go"
	"github.com/easymonitor/product-service/internal/controller"
	"github.com/easymonitor/product-service/internal/domain"
	"github.com/easymonitor/product-service/internal/repository"
	"github.com/easymonitor/product-service/internal/service"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	ctx := context.Background()
	telemetry.Init("product-service")

	// Dependency Injection: Databases
	dbDsn := "host=localhost user=easymonitor password=password dbname=easymonitor port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dbDsn), &gorm.Config{})
	if err != nil {
		slog.Error("Failed to connect to database", "err", err)
	} else {
		db.AutoMigrate(&domain.Product{})
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	// Dependency Injection: DDD Layers
	repo := repository.NewProductRepository(db)
	repo.InitDefaults(ctx) // Seed missing defaults
	svc := service.NewProductService(repo, rdb)
	ctrl := controller.NewProductController(svc)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/product/", ctrl.HandleGetProduct)
	mux.HandleFunc("/api/product/search", ctrl.HandleSearch)
	mux.HandleFunc("/api/health", ctrl.HandleHealth)

	handler := telemetry.WrapHTTPHandler(mux, "product-service")
    
	slog.Info("Product Service (Go DDD) running on :8081")
	if err := http.ListenAndServe(":8081", handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
