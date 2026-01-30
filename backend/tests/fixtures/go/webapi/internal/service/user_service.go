// Package service contains business logic.
package service

import (
	"errors"

	"github.com/example/webapi/internal/repository"
	"github.com/example/webapi/pkg/models"
)

// ErrUserNotFound is returned when a user is not found.
var ErrUserNotFound = errors.New("user not found")

// UserService handles user business logic.
type UserService struct {
	repo *repository.UserRepository
}

// NewUserService creates a new UserService instance.
func NewUserService(repo *repository.UserRepository) *UserService {
	return &UserService{
		repo: repo,
	}
}

// GetAllUsers returns all users.
func (s *UserService) GetAllUsers() ([]models.User, error) {
	return s.repo.FindAll()
}

// GetUserByID returns a user by ID.
func (s *UserService) GetUserByID(id int) (*models.User, error) {
	user, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// CreateUser creates a new user.
func (s *UserService) CreateUser(req models.CreateUserRequest) (*models.User, error) {
	user := &models.User{
		Name:  req.Name,
		Email: req.Email,
	}
	return s.repo.Create(user)
}

// UpdateUser updates an existing user.
func (s *UserService) UpdateUser(id int, req models.UpdateUserRequest) (*models.User, error) {
	user, err := s.repo.FindByID(id)
	if err != nil {
		return nil, ErrUserNotFound
	}

	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Email != "" {
		user.Email = req.Email
	}

	return s.repo.Update(user)
}

// DeleteUser deletes a user by ID.
func (s *UserService) DeleteUser(id int) error {
	return s.repo.Delete(id)
}
