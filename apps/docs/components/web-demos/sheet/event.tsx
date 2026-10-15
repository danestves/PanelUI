'use client';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from 'panelui-web/sheet';

export default function SheetEvent() {
  return (
    <Sheet>
      <Sheet.Trigger render={<Button variant="outline" />}>Respond to invite</Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Header
          title="Design critique"
          description="Thursday 22 October · 14:00–15:00"
        />
        <Sheet.Body className="flex flex-col gap-6">
          <RadioGroup defaultValue="going" aria-label="Your answer">
            <Label>
              <Radio value="going" /> Going
            </Label>
            <Label>
              <Radio value="maybe" /> Maybe
            </Label>
            <Label>
              <Radio value="declined" /> Can’t make it
            </Label>
          </RadioGroup>
          <Field>
            <FieldLabel>Note to Noor</FieldLabel>
            <Textarea placeholder="Running ten minutes late, start without me." />
          </Field>
          <Label className="justify-between">
            Remind me 15 minutes before
            <Switch defaultChecked />
          </Label>
        </Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close render={<Button size="lg" />}>Send answer</Sheet.Close>
          <Sheet.Close render={<Button size="lg" variant="ghost" />}>Cancel</Sheet.Close>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  );
}
