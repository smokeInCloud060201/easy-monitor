package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"github.com/easymonitor/category-service/internal/domain"
	"github.com/easymonitor/category-service/internal/repository"
	"github.com/redis/go-redis/v9"
)

type CategoryService struct {
	repo  *repository.CategoryRepository
	redis *redis.Client
}

func NewCategoryService(repo *repository.CategoryRepository, rdb *redis.Client) *CategoryService {
	return &CategoryService{repo: repo, redis: rdb}
}

func (s *CategoryService) GetCategory(ctx context.Context, id string) (*domain.Category, bool, error) {
	start := time.Now()
	cacheKey := "category:" + id
	cacheHit := false

	simulatedDelay := rand.Intn(5) + 1
	time.Sleep(time.Duration(simulatedDelay) * time.Millisecond)

	val, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var cat domain.Category
		if json.Unmarshal([]byte(val), &cat) == nil {
			cacheHit = true
			slog.Info(fmt.Sprintf("Cache hit for %s in %dms", id, time.Since(start).Milliseconds()))
			return &cat, cacheHit, nil
		}
	}

	slog.Info(fmt.Sprintf("Cache miss for %s, querying DB", id))
	time.Sleep(time.Duration(15+rand.Intn(45)) * time.Millisecond)
	
	cat, err := s.repo.GetByID(ctx, id)
	if err != nil || cat == nil {
		slog.Warn("Category not found, falling back to electronics")
		cat, _ = s.repo.GetByID(ctx, "electronics")
	}

	if cat != nil {
		if data, err := json.Marshal(cat); err == nil {
			s.redis.Set(ctx, cacheKey, data, 5*time.Minute)
		}
	}

	slog.Info(fmt.Sprintf("Request completed in %dms - cacheHit: %v", time.Since(start).Milliseconds(), cacheHit))
	return cat, cacheHit, nil
}

func (s *CategoryService) SearchCategories(ctx context.Context, q string) ([]domain.Category, error) {
	start := time.Now()
	slog.Info(fmt.Sprintf("Search started: %s", q))

	time.Sleep(time.Duration(2+rand.Intn(6)) * time.Millisecond)
	time.Sleep(time.Duration(30+rand.Intn(70)) * time.Millisecond)

	results, err := s.repo.Search(ctx, q)
	slog.Info(fmt.Sprintf("Search completed in %dms", time.Since(start).Milliseconds()))
	return results, err
}
