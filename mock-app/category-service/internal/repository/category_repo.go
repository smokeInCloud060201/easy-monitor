package repository

import (
	"context"
	"github.com/easymonitor/category-service/internal/domain"
	"gorm.io/gorm"
)

type CategoryRepository struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) GetByID(ctx context.Context, id string) (*domain.Category, error) {
	var category domain.Category
	if err := r.db.WithContext(ctx).First(&category, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *CategoryRepository) Search(ctx context.Context, q string) ([]domain.Category, error) {
	var categories []domain.Category
	if err := r.db.WithContext(ctx).Where("name ILIKE ?", "%"+q+"%").Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

func (r *CategoryRepository) InitDefaults(ctx context.Context) error {
	defaults := []domain.Category{
		{ID: "electronics", Name: "Premium Electronics", Stock: 150, PriceRange: "$50-$2000", Products: 120},
		{ID: "clothing", Name: "Designer Clothing", Stock: 320, PriceRange: "$20-$500", Products: 400},
		{ID: "books", Name: "Books & Media", Stock: 890, PriceRange: "$5-$100", Products: 1500},
		{ID: "home", Name: "Home & Garden", Stock: 210, PriceRange: "$10-$800", Products: 340},
		{ID: "sports", Name: "Sports & Outdoors", Stock: 175, PriceRange: "$15-$600", Products: 250},
	}
	for _, cat := range defaults {
		r.db.WithContext(ctx).Save(&cat)
	}
	return nil
}
