package guild

import (
	"fmt"
	"unicode/utf8"

	"github.com/kia280/guma/internal/services/errs"
)

const (
	maxNameLength            = 100
	maxDescriptionLength     = 2000
	maxImageURLLength        = 2048
	maxSettingCodeLength     = 64
	maxCustomSettings        = 50
	maxCustomSettingKeyLen   = 100
	maxCustomSettingValueLen = 2000
)

type textLimit struct {
	field string
	value string
	max   int
}

func checkLengths(limits ...textLimit) error {
	for _, l := range limits {
		if utf8.RuneCountInString(l.value) > l.max {
			return fmt.Errorf("%w: %s must be at most %d characters", errs.ErrInvalidArgument, l.field, l.max)
		}
	}
	return nil
}

func validateGuildFields(name, description, iconURL, bannerURL string, customSettings map[string]string) error {
	if err := checkLengths(
		textLimit{"name", name, maxNameLength},
		textLimit{"description", description, maxDescriptionLength},
		textLimit{"icon_url", iconURL, maxImageURLLength},
		textLimit{"banner_url", bannerURL, maxImageURLLength},
	); err != nil {
		return err
	}
	return validateCustomSettings(customSettings)
}

func validateSettings(settings GuildSettings) error {
	if err := checkLengths(
		textLimit{"timezone", settings.Timezone, maxSettingCodeLength},
		textLimit{"language", settings.Language, maxSettingCodeLength},
	); err != nil {
		return err
	}
	return validateCustomSettings(settings.CustomSettings)
}

func validateCustomSettings(settings map[string]string) error {
	if len(settings) > maxCustomSettings {
		return fmt.Errorf("%w: custom_settings must have at most %d entries", errs.ErrInvalidArgument, maxCustomSettings)
	}
	for key, value := range settings {
		if err := checkLengths(
			textLimit{"custom_settings key", key, maxCustomSettingKeyLen},
			textLimit{"custom_settings value", value, maxCustomSettingValueLen},
		); err != nil {
			return err
		}
	}
	return nil
}
