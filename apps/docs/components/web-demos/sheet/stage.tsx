'use client';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Card } from 'panelui-web/card';
import { Sheet } from 'panelui-web/sheet';

const ACTIVITY = [
  { name: 'Rent', date: '1 Oct', amount: '−£1,240.00' },
  { name: 'Salary', date: '30 Sep', amount: '+£3,180.00' },
  { name: 'Grocer’s', date: '29 Sep', amount: '−£46.20' },
  { name: 'Train pass', date: '28 Sep', amount: '−£128.00' },
];

const DESTINATIONS = ['To savings', 'To a friend', 'Pay a bill', 'Top up card'];

export default function SheetStageDemo() {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border">
      <Sheet.Stage className="[--stage-radius:26px]">
        <div className="flex flex-col gap-3 p-3">
          <Card size="sm" className="rounded-[20px]">
            <Card.Header>
              <Card.Description>Current account</Card.Description>
              <Card.Title className="text-3xl tracking-tight">£2,914.06</Card.Title>
            </Card.Header>
            <Card.Content>
              <Table>
                <TableBody>
                  {ACTIVITY.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.date}</TableCell>
                      <TableCell className="text-end tabular-nums">{row.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card.Content>
          </Card>
          <Sheet>
            <Sheet.Trigger render={<Button size="lg" />}>Move money</Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Header title="Move money" description="From your current account" />
              <Sheet.Footer>
                {DESTINATIONS.map((label) => (
                  <Sheet.Close key={label} render={<Button size="lg" variant="outline" />}>
                    {label}
                  </Sheet.Close>
                ))}
              </Sheet.Footer>
            </Sheet.Content>
          </Sheet>
        </div>
      </Sheet.Stage>
    </div>
  );
}
