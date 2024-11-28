package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/joho/godotenv"
)

var instance *sql.DB = nil
var once sync.Once

func InitDB() *sql.DB {
	once.Do(func() {
		err := godotenv.Load()

		if err != nil {
			log.Fatal(err)
		}
		connStr := fmt.Sprintf("host=%s port=%s user=%s dbname=%s sslmode=disable password=%s",
			os.Getenv("PG_HOST"),
			os.Getenv("PG_PORT"),
			os.Getenv("PG_USERNAME"),
			os.Getenv("PG_DATABASE"),
			os.Getenv("PG_PASSWORD"),
		)

		instance, err = sql.Open("postgres", connStr)

		if err != nil {
			log.Fatal(err)
		}

		instance.SetMaxOpenConns(25)               // Max open connections to the database
		instance.SetMaxIdleConns(25)               // Max idle connections in the pool
		instance.SetConnMaxLifetime(5 * 60 * 1000) // Set a timeout for how long a connection may be reused
	})

	return instance
}
