package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/kia280/guma/internal/services/health"
)

var healthcheckCmd = &cobra.Command{
	Use:   "healthcheck",
	Short: "Probe the server over the gRPC health protocol",
	Long:  `Call grpc.health.v1.Health/Check and exit non-zero unless the service is SERVING`,
	Args:  cobra.NoArgs,
	RunE:  runHealthcheck,
}

func init() {
	healthcheckCmd.Flags().String("addr", "localhost:50051", "gRPC server address")
	healthcheckCmd.Flags().String("service", health.ReadinessService, "health service name (liveness, readiness, or empty for overall)")
	healthcheckCmd.Flags().Duration("timeout", 3*time.Second, "probe timeout")
	rootCmd.AddCommand(healthcheckCmd)
}

func runHealthcheck(cmd *cobra.Command, args []string) error {
	addr, _ := cmd.Flags().GetString("addr")
	service, _ := cmd.Flags().GetString("service")
	timeout, _ := cmd.Flags().GetDuration("timeout")

	cmd.SilenceUsage = true
	cmd.SilenceErrors = true

	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return fmt.Errorf("connect to %s: %w", addr, err)
	}
	defer conn.Close()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	resp, err := healthpb.NewHealthClient(conn).Check(ctx, &healthpb.HealthCheckRequest{Service: service})
	if err != nil {
		return fmt.Errorf("health check %q: %w", service, err)
	}
	if resp.GetStatus() != healthpb.HealthCheckResponse_SERVING {
		return fmt.Errorf("health check %q: %s", service, resp.GetStatus())
	}

	fmt.Fprintf(cmd.OutOrStdout(), "%s: %s\n", displayServiceName(service), resp.GetStatus())
	return nil
}

func displayServiceName(service string) string {
	if service == "" {
		return "overall"
	}
	return service
}
