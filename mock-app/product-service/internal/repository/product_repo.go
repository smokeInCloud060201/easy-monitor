package repository

import (
	"context"
	"github.com/easymonitor/product-service/internal/domain"
	"gorm.io/gorm"
)

type ProductRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) *ProductRepository {
	return &ProductRepository{db: db}
}

func (r *ProductRepository) GetByID(ctx context.Context, id string) (*domain.Product, error) {
	var product domain.Product
	if err := r.db.WithContext(ctx).First(&product, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *ProductRepository) Search(ctx context.Context, q string) ([]domain.Product, error) {
	var categories []domain.Product
	if err := r.db.WithContext(ctx).Where("name ILIKE ?", "%"+q+"%").Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

func (r *ProductRepository) InitDefaults(ctx context.Context) error {
	defaults := []domain.Product{
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
