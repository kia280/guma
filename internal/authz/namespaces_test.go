package authz

import (
	"os"
	"regexp"
	"slices"
	"testing"
)

func oplIdentifiers(t *testing.T, pattern string) []string {
	t.Helper()
	src, err := os.ReadFile("namespaces.keto.ts")
	if err != nil {
		t.Fatalf("read OPL: %v", err)
	}
	var out []string
	for _, m := range regexp.MustCompile(pattern).FindAllStringSubmatch(string(src), -1) {
		out = append(out, m[1])
	}
	return out
}

func TestPermissionsMatchOPL(t *testing.T) {
	permits := oplIdentifiers(t, `(?m)^\s+(\w+): \(ctx: Context\): boolean =>`)
	for _, p := range Permissions {
		if !slices.Contains(permits, string(p)) {
			t.Errorf("permission %q is not defined in namespaces.keto.ts", p)
		}
	}
	for _, name := range permits {
		if regexp.MustCompile(`^is_`).MatchString(name) {
			continue
		}
		if !slices.Contains(Permissions, Permission(name)) {
			t.Errorf("OPL permit %q has no Go Permission constant", name)
		}
	}
}

func TestRoleRelationsMatchOPL(t *testing.T) {
	relations := oplIdentifiers(t, `(?m)^\s+(\w+): User\[\]`)
	if len(relations) != len(Roles) {
		t.Fatalf("OPL relations = %v, want one per role %v", relations, Roles)
	}
	for _, r := range Roles {
		if !slices.Contains(relations, roleRelations[r]) {
			t.Errorf("role %q relation %q is not defined in namespaces.keto.ts", r, roleRelations[r])
		}
	}
}

func TestParseRole(t *testing.T) {
	for _, r := range Roles {
		if got, ok := ParseRole(string(r)); !ok || got != r {
			t.Errorf("ParseRole(%q) = %q, %v", r, got, ok)
		}
	}
	for _, s := range []string{"", "Owner", "superuser"} {
		if _, ok := ParseRole(s); ok {
			t.Errorf("ParseRole(%q) accepted an unknown role", s)
		}
	}
}
