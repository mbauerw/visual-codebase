// Package repository handles data access.
package repository

import (
	"errors"
	"sync"

	"github.com/example/webapi/pkg/models"
)

// ErrNotFound is returned when an entity is not found.
var ErrNotFound = errors.New("not found")

// UserRepository handles user data access.
type UserRepository struct {
	mu    sync.RWMutex
	users map[int]*models.User
	nextID int
}

// NewUserRepository creates a new UserRepository instance.
func NewUserRepository() *UserRepository {
	return &UserRepository{
		users:  make(map[int]*models.User),
		nextID: 1,
	}
}

// FindAll returns all users.
func (r *UserRepository) FindAll() ([]models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]models.User, 0, len(r.users))
	for _, user := range r.users {
		result = append(result, *user)
	}
	return result, nil
}

// FindByID returns a user by ID.
func (r *UserRepository) FindByID(id int) (*models.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	user, ok := r.users[id]
	if !ok {
		return nil, ErrNotFound
	}
	return user, nil
}

// Create creates a new user.
func (r *UserRepository) Create(user *models.User) (*models.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	user.ID = r.nextID
	r.nextID++
	r.users[user.ID] = user
	return user, nil
}

// Update updates an existing user.
func (r *UserRepository) Update(user *models.User) (*models.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.users[user.ID]; !ok {
		return nil, ErrNotFound
	}
	r.users[user.ID] = user
	return user, nil
}

// Delete deletes a user by ID.
func (r *UserRepository) Delete(id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.users[id]; !ok {
		return ErrNotFound
	}
	delete(r.users, id)
	return nil
}
