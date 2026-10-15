'use client';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, type SheetSide } from 'panelui-web/sheet';

const SIDES: SheetSide[] = ['top', 'right', 'bottom', 'left'];

function Workspace({ side }: { side: SheetSide }) {
  return (
    <Sheet side={side}>
      <Sheet.Trigger render={<Button variant="outline" className="capitalize" />}>{side}</Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Header title="Workspace" description="Northwind Studio · 12 members" />
        <Sheet.Body>
          <Field>
            <FieldLabel>Workspace name</FieldLabel>
            <Input defaultValue="Northwind Studio" />
          </Field>
        </Sheet.Body>
        <Sheet.Footer>
          {/* The second sheet comes from the same edge and the first steps back. */}
          <Sheet side={side}>
            <Sheet.Trigger render={<Button size="lg" />}>Invite people</Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Header title="Invite people" description="They join as members and can be promoted later." />
              <Sheet.Body>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input type="email" placeholder="name@northwind.studio" />
                </Field>
              </Sheet.Body>
              <Sheet.Footer>
                <Sheet.Close render={<Button size="lg" />}>Send invite</Sheet.Close>
              </Sheet.Footer>
            </Sheet.Content>
          </Sheet>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  );
}

export default function SheetNestedSides() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SIDES.map((side) => (
        <Workspace key={side} side={side} />
      ))}
    </div>
  );
}
