# Deployment Instructions

This document provides step-by-step instructions to deploy the Guma application, including both backend and frontend components.

## Prerequisites


## Step 1: Setup Infrastructure

## Authorization (Ory Keto)

Guild authorization is delegated to [Ory Keto](https://www.ory.sh/keto/) v25.

1. Deploy Keto with the namespace definitions from
   `internal/authz/namespaces.keto.ts` (for example, mount the file and point
   `namespaces.location` at it). Keep `limit.max_read_depth` at 5 or higher; the
   role hierarchy needs that depth.
2. Set `keto.readAddr` and `keto.writeAddr` in the chart values to the gRPC
   `host:port` of the Keto read and write APIs. The write API must be reachable
   from the backend pods but should not be exposed publicly.
3. Apply database migrations. A trigger on `members` queues every membership
   change in `authz_member_outbox`, and the backend writes the matching relation
   tuples to Keto shortly after it starts. For a database that already had
   members before the trigger existed, run `guma authz sync` once.
4. To repair drift between `members` and Keto at any time, run
   `guma authz sync`; it is idempotent.
