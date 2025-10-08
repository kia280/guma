package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "guma",
	Short: "Guma - Guild Management Application",
	Long: `Guma is a comprehensive guild management web application
designed for gaming communities and organizations.`,
}

// Execute runs the root command
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// Add global flags here if needed
	rootCmd.PersistentFlags().StringP("config", "c", "", "config file path")
}
