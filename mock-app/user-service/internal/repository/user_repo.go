package repository

import (
	"context"
	"github.com/easymonitor/user-service/internal/domain"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) Search(ctx context.Context, q string) ([]domain.User, error) {
	var categories []domain.User
	if err := r.db.WithContext(ctx).Where("name ILIKE ?", "%"+q+"%").Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

func (r *UserRepository) InitDefaults(ctx context.Context) error {
	defaults := []domain.User{
		{ID: "electronics", Name: "Premium Electronics", Stock: 150, PriceRange: "$50-$2000", Users: 120},
		{ID: "clothing", Name: "Designer Clothing", Stock: 320, PriceRange: "$20-$500", Users: 400},
		{ID: "books", Name: "Books & Media", Stock: 890, PriceRange: "$5-$100", Users: 1500},
		{ID: "home", Name: "Home & Garden", Stock: 210, PriceRange: "$10-$800", Users: 340},
		{ID: "sports", Name: "Sports & Outdoors", Stock: 175, PriceRange: "$15-$600", Users: 250},
	}
	for _, cat := range defaults {
		r.db.WithContext(ctx).Save(&cat)
	}
	return nil
}
