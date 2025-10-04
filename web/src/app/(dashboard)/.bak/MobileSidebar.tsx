'use client'
import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  CalendarIcon,
  ChartPieIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  HomeIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { Link, Button } from "@heroui/react";
import ThemeSwitcher from '../ThemeSwitcher';
import { LogoIcon } from '@/components/Logo';

function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export default function MobileSidebar({
  sidebarOpen,
  setSidebarOpen,
  navigation
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  navigation: { icon: any; name: string; href: string; current: boolean }[];
}) {
  return (
    <>
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-30 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-background/[.75]" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                {/* Sidebar component, swap this element with another sidebar if you like */}
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-content1 shadow-medium px-6 pb-4">
                  <div className="flex h-16 shrink-0 items-center">
                    <LogoIcon size="sm" priority />
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <Button
                                href={item.href}
                                as={Link}
                                color="primary"
                                variant="solid"
                                className={
                                  classNames(
                                    item.current
                                      ? 'bg-primary-100 light:text-content1 dark:text-foreground'
                                      : 'text-foreground bg-transparent',
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
                              {/* <a
                                  href={item.href}
                                  className={classNames(
                                    item.current
                                      ? 'bg-gray-50 text-secondary-500'
                                      : 'text-default-700 hover:text-secondary-500 hover:bg-gray-50',
                                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                  )}
                                >
                                </a> */}
                            </li>
                          ))}
                        </ul>
                      </li>
                    </ul>
                  </nav>
                  <ThemeSwitcher />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

    </>
  )
}
