package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"github.com/easymonitor/product-service/internal/domain"
	"github.com/easymonitor/product-service/internal/repository"
	"github.com/redis/go-redis/v9"
)

type ProductService struct {
	repo  *repository.ProductRepository
	redis *redis.Client
}

func NewProductService(repo *repository.ProductRepository, rdb *redis.Client) *ProductService {
	return &ProductService{repo: repo, redis: rdb}
}

func (s *ProductService) GetProduct(ctx context.Context, id string) (*domain.Product, bool, error) {
	start := time.Now()
	cacheKey := "product:" + id
	cacheHit := false

	simulatedDelay := rand.Intn(5) + 1
	time.Sleep(time.Duration(simulatedDelay) * time.Millisecond)

	val, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var cat domain.Product
		if json.Unmarshal([]byte(val), &cat) == nil {
			cacheHit = true
			slog.InfoContext(ctx, fmt.Sprintf("Cache hit for %s in %dms", id, time.Since(start).Milliseconds()))
			return &cat, cacheHit, nil
		}
	}

	slog.InfoContext(ctx, fmt.Sprintf("Cache miss for %s, querying DB", id))
	time.Sleep(time.Duration(15+rand.Intn(45)) * time.Millisecond)
	
	cat, err := s.repo.GetByID(ctx, id)
	if err != nil || cat == nil {
		slog.WarnContext(ctx, "Product not found, falling back to electronics")
		cat, _ = s.repo.GetByID(ctx, "electronics")
	}

	if cat != nil {
		if data, err := json.Marshal(cat); err == nil {
			s.redis.Set(ctx, cacheKey, data, 5*time.Minute)
		}
	}

	slog.InfoContext(ctx, fmt.Sprintf("Request completed in %dms - cacheHit: %v", time.Since(start).Milliseconds(), cacheHit))
	return cat, cacheHit, nil
}

func (s *ProductService) SearchCategories(ctx context.Context, q string) ([]domain.Product, error) {
	start := time.Now()
	slog.InfoContext(ctx, fmt.Sprintf("Search started: %s", q))

	time.Sleep(time.Duration(2+rand.Intn(6)) * time.Millisecond)
	time.Sleep(time.Duration(30+rand.Intn(70)) * time.Millisecond)

	results, err := s.repo.Search(ctx, q)
	slog.InfoContext(ctx, fmt.Sprintf("Search completed in %dms", time.Since(start).Milliseconds()))
	return results, err
}
