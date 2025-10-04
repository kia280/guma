import React from "react";
import {Button, Spacer} from "@heroui/react";
import { CheckinCard, CheckinStatus } from "./CheckinCard"
import { useTranslations } from "next-intl";
import { PlusIcon } from "@heroicons/react/24/outline";

export default function Index() {
  const t = useTranslations('checkIn');
  return (
    <>
      <div>
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row justify-between items-center">
            <h2 className="text-2xl font-medium text-semibold leading-6 text-foreground">{t('checkIn')}</h2>
            <span className="w-32">
              <Button
                color="primary"
                startContent={<PlusIcon/>}
                fullWidth
              >{t('addCheckIn')}</Button>
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CheckinCard
              status={CheckinStatus.OPEN}
              date="2024/07/24 22:47"
              description="蜘蛛"
            />
            <CheckinCard
              status={CheckinStatus.OPEN}
              date="2024/07/24 22:47"
              description="蜘蛛"
            />
            <CheckinCard
              status={CheckinStatus.FINISHED}
              date="2024/07/24 22:47"
              description="蜘蛛"
            />
            <CheckinCard
              status={CheckinStatus.CLOSED}
              date="2024/07/24 22:47"
              description="蜘蛛"
              isDisabled={true}
            />
            {/* <Spacer x={4} />
            <Spacer x={4} /> */}
          </div>
        </div>
      </div>
    </>
  );
}
