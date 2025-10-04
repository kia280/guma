"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Switch } from "@heroui/react";
import { MoonIcon, SunIcon } from '@heroicons/react/24/solid'
import { useTranslations } from "next-intl";

export default function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const t = useTranslations('ThemeSwitcher')

  useEffect(() => {
    setMounted(true)
  }, [])

  if(!mounted) return null

  const isDark = resolvedTheme === 'dark'

  return (
    <Switch
      isSelected={isDark}
      size="sm"
      color="primary"
      startContent={<SunIcon className="w-4 h-4" />}
      endContent={<MoonIcon className="w-4 h-4" />}
      className="text-sm font-semibold leading-6 text-default-700"
      onValueChange={(isSelected) => setTheme(isSelected ? 'dark' : 'light')}
    >
      <span className="ml-2">{t("DarkTheme")}</span>
    </Switch>
  );
}
