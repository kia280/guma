'use client';

import React from 'react';
import { Drawer, Button } from '@heroui/react';
import { cn } from '@heroui/react';

interface SidebarDrawerProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  hideCloseButton?: boolean;
  sidebarWidth?: number;
  sidebarPlacement?: 'left' | 'right';
}

const SidebarDrawer = React.forwardRef<HTMLDivElement, SidebarDrawerProps>(
  (
    {
      children,
      className,
      isOpen,
      onOpenChange,
      hideCloseButton = false,
      sidebarPlacement = 'left',
    },
    ref
  ) => {
    return (
      <>
        <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
          <Drawer.Backdrop>
            <Drawer.Content placement={sidebarPlacement}>
              <Drawer.Dialog className="h-full max-h-full w-72 sm:w-72 max-w-[85vw] rounded-none m-0 p-0">
                {!hideCloseButton && <Drawer.CloseTrigger />}
                <Drawer.Body className="m-0 p-0">{children}</Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
        <div ref={ref} className={cn('hidden h-full overflow-x-hidden lg:flex', className)}>
          {children}
        </div>
      </>
    );
  }
);

SidebarDrawer.displayName = 'SidebarDrawer';

export { SidebarDrawer };
