import { useTranslations } from 'next-intl';
import { Link, Button } from "@heroui/react";
import {
  CalendarIcon,
  ChartPieIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  HomeIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import ThemeSwitcher from '../ThemeSwitcher';
import { Logo } from '@/components/Logo';

function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export default function DesktopSidebar({
  navigation
}: {
  navigation: { icon: any; name: string; href: string; current: boolean }[];
}) {
  const t = useTranslations('Sidebar');

  return (
    <>
      <div className="bg-content1 flex grow flex-col overflow-y-auto shadow-small px-3 pb-4">
        <div className="flex ml-1 mt-2 h-16 shrink-0 items-center">
          <Logo size="sm" text="桑貝幣系統" priority />
        </div>
        <nav className="flex mt-4 flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Button
                      href={item.href}
                      size="lg"
                      radius="full"
                      as={Link}
                      variant='light'
                      className={
                        classNames(
                          item.current
                            ? 'bg-primary-100 light:text-content1 dark:text-foreground'
                            : 'text-foreground',
                          "justify-start hover:text-primary-600 font-medium group flex gap-x-3 rounded-lg p-2 text-base leading-6"
                        )}
                    >
                      <item.icon
                        className={classNames(
                          item.current ? 'text-foreground' : 'text-foreground group-hover:text-primary-600',
                          'text-left ml-2 mr-2 h-7 w-7 shrink-0'
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
            {/* <li className="mt-auto">
                  <Button
                    href="#"
                    as={Link}
                    className="justify-start group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-default-700 bg-background hover:bg-content2 hover:text-secondary-500"
                  >
                    <Cog6ToothIcon
                      className="h-6 w-6 shrink-0 text-default-400 group-hover:text-secondary-500"
                      aria-hidden="true"
                    />
                    Settings
                  </Button>
                </li> */}
          </ul>
        </nav>
        <ThemeSwitcher />
      </div>
    </>
  )
}
