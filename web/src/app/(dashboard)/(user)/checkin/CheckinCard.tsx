import {Card, CardHeader, CardBody, Image} from "@heroui/react";

export enum CheckinStatus {
  OPEN = 1,
  CLOSED = 2,
  FINISHED = 3
}

export function CheckinCard({
  status,
  date,
  description,
  isDisabled
} : {
  status: CheckinStatus;
  date: string;
  description: string;
  isDisabled ?: boolean | undefined;
}) {

  const statusMap = {
    [CheckinStatus.OPEN]: "進行中",
    [CheckinStatus.CLOSED]: "已關閉",
    [CheckinStatus.FINISHED]: "已完成"
  }

  return (
    <>
      <Card
        className="py-4"
        isDisabled={isDisabled}
        isPressable={isDisabled ? false : true}
      >
        <CardHeader className="pb-0 pt-2 px-4 flex-col items-start">
          <p className="text-tiny uppercase font-bold">{statusMap[status]}</p>
          <small className="text-default-500">{date}</small>
          <h4 className="font-bold text-large">{description}</h4>
        </CardHeader>
        <CardBody className="pb-0 pt-2">
          <div className="overflow-hidden rounded-xl z-0">
            <Image
              alt="Card background"
              className={"object-cover" + (isDisabled ? " grayscale" : " hover:scale-125")}
              src="https://media.discordapp.net/attachments/1371110249561587798/1371112013320683671/1840.png?ex=68c81012&is=68c6be92&hm=42429a5409faa6a50fcb822d55aebc868887368ac9735087c43665d7dd05cf04&=&format=webp&quality=lossless&width=825&height=464"
            />
          </div>
        </CardBody>
      </Card>
    </>
  );
}
