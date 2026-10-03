package cmd

import (
	"context"
	"fmt"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/config"
	"github.com/kia280/guma/internal/database"
)

var authzCmd = &cobra.Command{
	Use:   "authz",
	Short: "Manage guild authorization data in Ory Keto",
}

var authzSyncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Sync every guild membership into Keto",
	Long: `Write the Keto relation tuple for every guild member's role, remove tuples
for memberships that no longer exist, and drain the pending authorization outbox.
Safe to run repeatedly.`,
	Args: cobra.NoArgs,
	RunE: runAuthzSync,
}

func init() {
	authzCmd.AddCommand(authzSyncCmd)
	rootCmd.AddCommand(authzCmd)
}

func runAuthzSync(cmd *cobra.Command, args []string) error {
	cmd.SilenceUsage = true

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}
	logger := initLogger(cfg)

	pool, err := database.NewPool(ctx, database.Config{
		URL:          cfg.Database.URL,
		MaxOpenConns: int32(cfg.Database.MaxOpenConns),
		MaxIdleConns: int32(cfg.Database.MaxIdleConns),
		Logger:       logger,
	})
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer pool.Close()

	keto, err := authz.DialKeto(cfg.Keto.ReadAddr, cfg.Keto.WriteAddr)
	if err != nil {
		return err
	}
	defer keto.Close() //nolint:errcheck

	syncer := authz.NewSyncer(pool, keto, logger)
	res, err := syncer.Backfill(ctx)
	if err != nil {
		return err
	}
	drained, err := syncer.Drain(ctx)
	if err != nil {
		return fmt.Errorf("drain authorization outbox: %w", err)
	}

	fmt.Fprintf(cmd.OutOrStdout(), "synced %d members, removed %d stale memberships, drained %d outbox entries\n",
		res.Members, res.Stale, drained)
	return nil
}
