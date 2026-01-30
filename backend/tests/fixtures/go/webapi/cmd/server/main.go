// Package main is the entry point for the web API server.
package main

import (
	"log"
	"os"

	"github.com/example/webapi/internal/handler"
	"github.com/example/webapi/internal/repository"
	"github.com/example/webapi/internal/service"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize dependencies
	userRepo := repository.NewUserRepository()
	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService)

	// Setup router
	r := gin.Default()

	// Register routes
	api := r.Group("/api/v1")
	{
		api.GET("/users", userHandler.ListUsers)
		api.GET("/users/:id", userHandler.GetUser)
		api.POST("/users", userHandler.CreateUser)
		api.PUT("/users/:id", userHandler.UpdateUser)
		api.DELETE("/users/:id", userHandler.DeleteUser)
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
