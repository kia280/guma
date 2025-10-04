"use client";

import React from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Link,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Avatar,
  Tooltip,
  Spacer,
  Badge,
  useDisclosure
} from "@heroui/react";
import {useMediaQuery} from "usehooks-ts";
import {Icon} from "@iconify/react";

import {Logo, NotificationsCard, SidebarDrawer, Sidebar} from "@/components";
import {cn} from "@heroui/react";
import { useTranslations } from "next-intl";
import { useRouter } from 'next/navigation';
import {kratos} from '@/lib/kratos';

interface SidebarItem {
  key: string;
  title: string;
  icon?: string;
  href?: string;
  endContent?: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("dashboardLayout");

  const items: SidebarItem[] = [
    {
      key: "dashboard",
      icon: "heroicons:home",
      title: t("dashboard"),
    },
    {
      key: "checkin",
      icon: "heroicons:clipboard-document-check",
      title: t("checkin"),
    },
    {
      key: "wallet",
      icon: "heroicons:wallet",
      title: t("wallet"),
    },
    {
      key: "auction",
      icon: "heroicons:currency-dollar",
      title: t("auction"),
    },
    {
      key: "lottery",
      icon: "heroicons:ticket",
      title: t("lottery"),
    },
    {
      key: "calendar",
      icon: "heroicons:calendar-days",
      title: t("calendar"),
    },
    {
      key: "admin",
      icon: "heroicons:cog-6-tooth",
      title: t("admin"),
    },
  ];

  const {isOpen, onOpen, onOpenChange} = useDisclosure();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [selectedKey, setSelectedKey] = React.useState('dashboard');
  const router = useRouter();

  const isCompact = useMediaQuery("(max-width: 1024px)");
  const isMobile = useMediaQuery("(max-width: 768px)");

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
      setSelectedKey(path);
    }
  }, []);

  const onToggle = React.useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  return (
    <>
    <div className="flex h-screen w-full">
      {/* Main Content */}
      <SidebarDrawer
        className={cn("z-50 min-w-[288px] rounded-lg", {"min-w-[76px]": isCollapsed})}
        hideCloseButton={true}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      >
        <div
          className={cn(
            "will-change bg-default-100 transition-width relative flex h-full w-72 flex-col p-6",
            {
              "w-[83px] items-center px-[6px] py-6": isCollapsed,
            },
          )}
        >
          <div
            className={cn("flex items-center gap-3 pl-2", {
              "justify-center gap-0 pl-0": isCollapsed,
            })}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full">
              <Logo
                size="md"
                showText={false}
                className="h-10 w-10"
              />
            </div>
            <span
              className={cn("text-small w-full font-bold uppercase opacity-100", {
                "w-0 opacity-0": isCollapsed,
              })}
            >
              {t("sunbaby")}
            </span>
            <div className={cn("flex-end flex", {hidden: isCollapsed})}>
              <Icon
                className="dark:text-primary-foreground/60 cursor-pointer [&>g]:stroke-[1px]"
                icon="solar:round-alt-arrow-left-line-duotone"
                width={24}
                onClick={isMobile ? onOpenChange : onToggle}
              />
            </div>
          </div>

          <Spacer y={6} />

          <Sidebar
            defaultSelectedKey={selectedKey}
            iconClassName="group-data-[selected=true]:text-default-50"
            isCompact={isCollapsed}
            itemClasses={{
              base: "px-3 rounded-large data-[selected=true]:bg-foreground!",
              title: "group-data-[selected=true]:text-default-50",
            }}
            items={items}
            onSelect={(key) => key ? router.push(`/${key}`) : null}
          />

          <Spacer y={8} />

          <div
            className={cn("mt-auto flex flex-col", {
              "items-center": isCollapsed,
            })}
          >
            {isCollapsed && (
              <Button
                isIconOnly
                className="text-default-600 flex h-10 w-10"
                size="sm"
                variant="light"
                // onPress={() => paginate && paginate(page - 1)}
              >
                <Icon
                  className="dark:text-primary-foreground/60 cursor-pointer [&>g]:stroke-[1px]"
                  height={24}
                  icon="solar:round-alt-arrow-right-line-duotone"
                  width={24}
                  onClick={isMobile ? onOpenChange : onToggle}
                />
              </Button>
            )}
            <Tooltip content="Support" isDisabled={!isCollapsed} placement="right">
              <Button
                fullWidth
                className={cn(
                  "text-default-600 data-[hover=true]:text-foreground justify-start truncate",
                  {
                    "justify-center": isCollapsed,
                  },
                )}
                isIconOnly={isCollapsed}
                startContent={
                  isCollapsed ? null : (
                    <Icon
                      className="text-default-600 flex-none"
                      icon="solar:info-circle-line-duotone"
                      width={24}
                    />
                  )
                }
                variant="light"
              >
                {isCollapsed ? (
                  <Icon
                    className="text-default-500"
                    icon="solar:info-circle-line-duotone"
                    width={24}
                  />
                ) : (
                  "Support"
                )}
              </Button>
            </Tooltip>
          </div>
        </div>
      </SidebarDrawer>

      <div className="flex-1 flex flex-col z-0">
        <Navbar
          classNames={{
            item: "data-[active=true]:text-primary",
            wrapper: "px-4 sm:px-6 max-w-full",
          }}
          height="64px"
        >
          <NavbarContent className="h-12 max-w-fit items-center gap-0" justify="start">
            {isCompact && (
              <Button
                isIconOnly
                className={cn("text-default-500 flex")}
                size="sm"
                variant="light"
                onPress={onOpen}
              >
                <Icon height={24} icon="solar:hamburger-menu-outline" width={24} />
              </Button>
            )}
          </NavbarContent>
          {/* Right Menu */}
          <NavbarContent className="ml-auto h-12 max-w-fit items-center gap-0" justify="end">
            {/* Mobile search */}
            {/* <NavbarItem className="lg:hidden">
              <Button isIconOnly radius="full" variant="light">
                <Icon className="text-default-500" icon="solar:magnifer-linear" width={20} />
              </Button>
            </NavbarItem> */}
            
            {/* Theme change */}
            {/* <NavbarItem className="hidden lg:flex">
              <Button
                isIconOnly
                radius="full"
                variant="light"
                onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Icon className="text-default-500" icon="solar:sun-linear" width={24} />
              </Button>
            </NavbarItem> */}
            
            {/* Settings */}
            {/* <NavbarItem className="hidden lg:flex">
              <Button isIconOnly radius="full" variant="light">
                <Icon className="text-default-500" icon="solar:settings-linear" width={24} />
              </Button>
            </NavbarItem> */}
            
            {/* Notifications */}
            <NavbarItem className="flex">
              <Popover offset={12} placement="bottom-end">
                <PopoverTrigger>
                  <Button
                    disableRipple
                    isIconOnly
                    className="overflow-visible"
                    radius="full"
                    variant="light"
                  >
                    <Badge color="danger" content="5" showOutline={false} size="md">
                      <Icon className="text-default-500" icon="solar:bell-linear" width={22} />
                    </Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="max-w-[90vw] p-0 sm:max-w-[380px]">
                  <NotificationsCard className="w-full shadow-none" />
                </PopoverContent>
              </Popover>
            </NavbarItem>
            
            
            {/* User Menu */}
            <NavbarItem className="px-2">
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <button className="mt-1 h-8 w-8 transition-transform">
                    <Badge color="success" content="" placement="bottom-right" shape="circle">
                      <Avatar size="sm" src="https://i.pravatar.cc/150?u=a04258114e29526708c" />
                    </Badge>
                  </button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Profile Actions" variant="flat">
                  <DropdownItem key="profile" className="h-14 gap-2">
                    <p className="font-semibold">Signed in as</p>
                    <p className="font-semibold">johndoe@example.com</p>
                  </DropdownItem>
                  <DropdownItem key="settings">My Settings</DropdownItem>
                  <DropdownItem key="team_settings">Team Settings</DropdownItem>
                  <DropdownItem key="analytics">Analytics</DropdownItem>
                  <DropdownItem key="system">System</DropdownItem>
                  
                  <DropdownItem key="configurations">Configurations</DropdownItem>
                  <DropdownItem key="help_and_feedback">Help & Feedback</DropdownItem>
                  <DropdownItem key="logout" color="danger">
                    Log Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          </NavbarContent>

          {/* Mobile Menu */}
          <NavbarMenu>
            <NavbarMenuItem>
              <Link className="w-full" color="foreground" href="#">
                Dashboard
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link className="w-full" color="foreground" href="#">
                Analytics
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link className="w-full" color="foreground" href="#">
                Team
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link className="w-full" color="foreground" href="#">
                Settings
              </Link>
            </NavbarMenuItem>
          </NavbarMenu>
        </Navbar>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  </>
  );
}
