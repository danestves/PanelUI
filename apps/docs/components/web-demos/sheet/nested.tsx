'use client';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet } from 'panelui-web/sheet';

export default function SheetNested() {
  return (
    <Sheet>
      <Sheet.Trigger render={<Button variant="outline" />}>Album settings</Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Header title="Album settings" description="Shared with five people · 214 photos" />
        <Sheet.Body className="flex flex-col gap-6">
          <Field>
            <FieldLabel>Name</FieldLabel>
            <Input defaultValue="Porto, May" />
          </Field>
          <Field>
            <Label className="w-full justify-between">
              Let others add photos
              <Switch defaultChecked />
            </Label>
            <FieldDescription>Everyone in the album can upload and remove their own.</FieldDescription>
          </Field>
        </Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close render={<Button size="lg" />}>Done</Sheet.Close>
          <Sheet>
            <Sheet.Trigger render={<Button size="lg" variant="destructive-outline" />}>
              Leave album
            </Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Header
                title="Leave “Porto, May”?"
                description="The photos you added stay in the album. Anyone in it can invite you back."
              />
              <Sheet.Footer>
                <Sheet.Close render={<Button size="lg" variant="destructive" />}>Leave album</Sheet.Close>
                <Sheet.Close render={<Button size="lg" variant="ghost" />}>Stay</Sheet.Close>
              </Sheet.Footer>
            </Sheet.Content>
          </Sheet>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  );
}
